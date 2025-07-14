import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getCurrentUser, formatTimestamp } from '@/lib/utils';
import { DynamoDBService } from '@/lib/dynamodb';

// Configure DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const ddbClient = DynamoDBDocumentClient.from(client);

const ASSETS_TABLE = 'water-tap-assets';
const ASSET_TYPES_TABLE = 'AssetTypes';
const FILTER_TYPES_TABLE = 'FilterTypes';

// Cache for asset types and filter types to avoid repeated scans
let assetTypesCache: Set<string> | null = null;
let filterTypesCache: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Parse date values from Excel/CSV - supports DD/MM/YYYY format
 */
function parseExcelDate(value: any): { date?: string; error?: string } {
  if (!value) return { date: undefined };
  
  // If it's already a Date object from Excel
  if (value instanceof Date) {
    return { date: value.toISOString().split('T')[0] };
  }
  
  // If it's a string, try to parse DD/MM/YYYY format
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return { date: undefined };
    
    // Check for DD/MM/YYYY format
    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = trimmed.match(ddmmyyyyRegex);
    
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      // Validate the date
      if (date.getFullYear() == parseInt(year) && 
          date.getMonth() == parseInt(month) - 1 && 
          date.getDate() == parseInt(day)) {
        return { date: date.toISOString().split('T')[0] };
      }
    }
    
    return { error: `Invalid date format: "${trimmed}". Please use DD/MM/YYYY format.` };
  }
  
  return { error: `Unsupported date format: ${typeof value}` };
}

/**
 * Parse boolean values from Excel/CSV
 */
function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'on';
  }
  if (typeof value === 'number') return value !== 0;
  return false;
}

/**
 * Field sanitization function
 */
function sanitizeField(value: any, fieldName: string): any {
  if (value === null || value === undefined) return value;
  
  const stringValue = String(value).trim();
  
  // Special handling for asset barcode - always uppercase
  if (fieldName === 'assetBarcode') {
    return stringValue.toUpperCase();
  }
  
  return stringValue;
}

/**
 * Get existing asset by barcode - optimized with case-insensitive search
 */
async function getAssetByBarcode(barcode: string) {
  try {
    // First try exact match (most efficient)
    const scanCommand = new ScanCommand({
      TableName: ASSETS_TABLE,
      FilterExpression: 'assetBarcode = :barcode',
      ExpressionAttributeValues: {
        ':barcode': barcode
      },
      Limit: 1 // Limit to 1 result for efficiency
    });
    
    const result = await ddbClient.send(scanCommand);
    if (result.Items && result.Items.length > 0) {
      return result.Items[0];
    }
    
    // If exact match fails, try case-insensitive search
    const caseInsensitiveScan = new ScanCommand({
      TableName: ASSETS_TABLE,
      FilterExpression: 'contains(assetBarcode, :barcode) OR contains(assetBarcode, :barcodeLower)',
      ExpressionAttributeValues: {
        ':barcode': barcode,
        ':barcodeLower': barcode.toLowerCase()
      },
      Limit: 10 // Limit for efficiency
    });
    
    const caseResult = await ddbClient.send(caseInsensitiveScan);
    if (caseResult.Items && caseResult.Items.length > 0) {
      // Find the best match (exact case-insensitive match)
      const bestMatch = caseResult.Items.find(item => 
        item.assetBarcode?.toLowerCase() === barcode.toLowerCase()
      );
      return bestMatch || caseResult.Items[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting asset by barcode:', error);
    throw error;
  }
}

/**
 * Load all assets into a normalized barcode map for fast lookup
 */
async function getAllAssetsMap() {
  const assetsMap = new Map();
  let lastEvaluatedKey = undefined;
  do {
    const scanResult: any = await ddbClient.send(new ScanCommand({
      TableName: ASSETS_TABLE,
      ExclusiveStartKey: lastEvaluatedKey,
      ProjectionExpression: 'id, assetBarcode',
    }));
    (scanResult.Items || []).forEach((item: any) => {
      if (item.assetBarcode) {
        assetsMap.set(String(item.assetBarcode).trim().toUpperCase(), item);
      }
    });
    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return assetsMap;
}

/**
 * Get cached asset types to avoid repeated scans
 */
async function getCachedAssetTypes(): Promise<Set<string>> {
  const now = Date.now();
  if (assetTypesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return assetTypesCache;
  }
  
  try {
    const scanResult = await ddbClient.send(new ScanCommand({
      TableName: ASSET_TYPES_TABLE,
      ProjectionExpression: '#label',
      ExpressionAttributeNames: { '#label': 'label' },
    }));
    
    assetTypesCache = new Set((scanResult.Items || []).map((item: any) => item.label?.toLowerCase()));
    cacheTimestamp = now;
    return assetTypesCache;
  } catch (error) {
    console.error('Error fetching asset types:', error);
    return new Set();
  }
}

/**
 * Get cached filter types to avoid repeated scans
 */
async function getCachedFilterTypes(): Promise<Set<string>> {
  const now = Date.now();
  if (filterTypesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return filterTypesCache;
  }
  
  try {
    const scanResult = await ddbClient.send(new ScanCommand({
      TableName: FILTER_TYPES_TABLE,
      ProjectionExpression: '#label',
      ExpressionAttributeNames: { '#label': 'label' },
    }));
    
    filterTypesCache = new Set((scanResult.Items || []).map((item: any) => item.label?.toLowerCase()));
    cacheTimestamp = now;
    return filterTypesCache;
  } catch (error) {
    console.error('Error fetching filter types:', error);
    return new Set();
  }
}

/**
 * Auto-create asset type if it doesn't exist - optimized
 */
async function ensureAssetTypeExists(assetType: string) {
  if (!assetType) return;
  const normalizedAssetType = assetType.trim().toLowerCase();
  
  try {
    const existingTypes = await getCachedAssetTypes();
    if (!existingTypes.has(normalizedAssetType)) {
      const typeId = `asset-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await ddbClient.send(new PutCommand({
        TableName: ASSET_TYPES_TABLE,
        Item: {
          typeId,
          label: assetType.trim(),
          createdAt: new Date().toISOString(),
          createdBy: 'bulk-update'
        },
        ConditionExpression: 'attribute_not_exists(#label)',
        ExpressionAttributeNames: { '#label': 'label' }
      }));
      
      // Update cache
      if (assetTypesCache) {
        assetTypesCache.add(normalizedAssetType);
      }
    }
  } catch (error: any) {
    if (error.name !== 'ConditionalCheckFailedException') {
      console.warn(`Failed to create asset type ${assetType}:`, error);
    }
  }
}

/**
 * Auto-create filter type if it doesn't exist - optimized
 */
async function ensureFilterTypeExists(filterType: string) {
  if (!filterType) return;
  const normalizedFilterType = filterType.trim().toLowerCase();
  
  try {
    const existingTypes = await getCachedFilterTypes();
    if (!existingTypes.has(normalizedFilterType)) {
      const typeId = `filter-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await ddbClient.send(new PutCommand({
        TableName: FILTER_TYPES_TABLE,
        Item: {
          typeId,
          label: filterType.trim(),
          createdAt: new Date().toISOString(),
          createdBy: 'bulk-update'
        },
        ConditionExpression: 'attribute_not_exists(#label)',
        ExpressionAttributeNames: { '#label': 'label' }
      }));
      
      // Update cache
      if (filterTypesCache) {
        filterTypesCache.add(normalizedFilterType);
      }
    }
  } catch (error: any) {
    if (error.name !== 'ConditionalCheckFailedException') {
      console.warn(`Failed to create filter type ${filterType}:`, error);
    }
  }
}

/**
 * Update asset with new data
 */
async function updateAsset(existingAsset: any, newData: any, currentUser: string) {
  try {
    // Build update expression dynamically based on provided fields
    const updateExpressions: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};
    
    // Fields that can be updated
    const updatableFields = [
      'assetType', 'status', 'primaryIdentifier', 'secondaryIdentifier',
      'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
      'filterNeeded', 'filtersOn', 'filterExpiryDate', 'filterInstalledOn',
      'filterType', 'needFlushing', 'notes', 'augmentedCare'
    ];
    
    let hasUpdates = false;
    
    for (const field of updatableFields) {
      if (newData[field] !== undefined && newData[field] !== null && newData[field] !== '') {
        const attributeName = `#${field}`;
        const attributeValue = `:${field}`;
        
        updateExpressions.push(`${attributeName} = ${attributeValue}`);
        expressionAttributeNames[attributeName] = field;
        expressionAttributeValues[attributeValue] = newData[field];
        hasUpdates = true;
      }
    }
    
    if (!hasUpdates) {
      return { updated: false, reason: 'No fields to update' };
    }
    
    // Always update modified timestamp and user
    updateExpressions.push('#modified = :modified', '#modifiedBy = :modifiedBy');
    expressionAttributeNames['#modified'] = 'modified';
    expressionAttributeNames['#modifiedBy'] = 'modifiedBy';
    expressionAttributeValues[':modified'] = new Date().toISOString();
    expressionAttributeValues[':modifiedBy'] = currentUser;
    
    const updateCommand = new UpdateCommand({
      TableName: ASSETS_TABLE,
      Key: { id: existingAsset.id },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await ddbClient.send(updateCommand);
    return { updated: true, asset: result.Attributes };
    
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');
    
    if (!isExcel && !isCsv) {
      return NextResponse.json({ 
        error: 'Only CSV and Excel (.xlsx, .xls) files are supported' 
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let data: any[] = [];

    if (isExcel) {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json<any>(sheet);
    } else {
      // Parse CSV file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json<any>(sheet);
    }

    if (data.length === 0) {
      return NextResponse.json({ 
        error: 'File must contain at least one data row' 
      }, { status: 400 });
    }

    // Pre-load caches to avoid repeated scans
    await Promise.all([
      getCachedAssetTypes(),
      getCachedFilterTypes()
    ]);

    // Load all assets into a normalized barcode map
    const assetsMap = await getAllAssetsMap();

    const results = {
      total: data.length,
      updated: 0,
      notFound: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as string[],
      notFoundBarcodes: [] as string[],
      skippedBarcodes: [] as string[],
      newAssetTypes: [] as string[],
      newFilterTypes: [] as string[]
    };

    const seenBarcodes = new Set<string>();
    const currentUser = getCurrentUser();
    const userEmail = typeof currentUser === 'string' ? currentUser : ((currentUser as any)?.email || 'unknown');

    // Process each row with timeout protection
    const startTime = Date.now();
    const maxProcessingTime = 25000; // 25 seconds max processing time

    for (let i = 0; i < data.length; i++) {
      // Check for timeout
      if (Date.now() - startTime > maxProcessingTime) {
        results.errors++;
        results.errorDetails.push(`Processing timeout after ${i} rows. Please try with a smaller file.`);
        break;
      }

      const row = data[i];
      const rowNum = i + 2; // Excel row number (1-based + header row)
      try {
        // Get barcode - this is required for identification
        const barcodeRaw = row['Asset Barcode'] || row['assetBarcode'] || row['barcode'];
        if (!barcodeRaw) {
          results.errors++;
          results.errorDetails.push(`Row ${rowNum}: Missing asset barcode`);
          continue;
        }
        // Sanitize barcode (uppercase and trim)
        const barcode = sanitizeField(barcodeRaw, 'assetBarcode');
        // Check for duplicate barcode in file
        if (seenBarcodes.has(barcode)) {
          results.skipped++;
          results.skippedBarcodes.push(barcode);
          continue;
        }
        seenBarcodes.add(barcode);
        // Lookup asset in the map
        const normalizedBarcode = String(barcode).trim().toUpperCase();
        const existingAsset = assetsMap.get(normalizedBarcode);
        if (!existingAsset) {
          results.notFound++;
          results.notFoundBarcodes.push(barcode);
          continue;
        }
        // Parse and prepare update data
        const updateData: any = {};
        // Map CSV/Excel columns to database fields
        const fieldMapping = {
          'Asset Type': 'assetType',
          'Status': 'status',
          'Primary Identifier': 'primaryIdentifier',
          'Secondary Identifier': 'secondaryIdentifier',
          'Wing': 'wing',
          'Wing In Short': 'wingInShort',
          'Room': 'room',
          'Floor': 'floor',
          'Floor In Words': 'floorInWords',
          'Room No': 'roomNo',
          'Room Name': 'roomName',
          'Filter Needed': 'filterNeeded',
          'Filters On': 'filtersOn',
          'Filter Expiry Date': 'filterExpiryDate',
          'Filter Installed On': 'filterInstalledOn',
          'Filter Type': 'filterType',
          'Need Flushing': 'needFlushing',
          'Notes': 'notes',
          'Augmented Care': 'augmentedCare'
        };
        // Process each field
        for (const [csvField, dbField] of Object.entries(fieldMapping)) {
          const value = row[csvField];
          if (value !== undefined && value !== null && value !== '') {
            if (dbField === 'filterExpiryDate' || dbField === 'filterInstalledOn') {
              // Handle date fields
              const dateResult = parseExcelDate(value);
              if (dateResult.error) {
                results.errors++;
                results.errorDetails.push(`Row ${rowNum}: ${dateResult.error}`);
                continue;
              }
              if (dateResult.date) {
                updateData[dbField] = dateResult.date;
              }
            } else if (dbField === 'filterNeeded' || dbField === 'filtersOn' || dbField === 'needFlushing' || dbField === 'augmentedCare') {
              // Handle boolean fields
              updateData[dbField] = parseBoolean(value);
            } else {
              // Handle string fields - sanitize all text fields
              updateData[dbField] = sanitizeField(value, dbField);
            }
          }
        }
        // Auto-calculate filter expiry date if filter installed date is provided but expiry date is not
        if (updateData.filterInstalledOn && !updateData.filterExpiryDate) {
          try {
            const installedDate = new Date(updateData.filterInstalledOn);
            const expiryDate = new Date(installedDate);
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            const originalDay = installedDate.getDate();
            if (expiryDate.getDate() !== originalDay) {
              expiryDate.setDate(1);
            }
            updateData.filterExpiryDate = expiryDate.toISOString().split('T')[0];
          } catch (error) {
            console.warn(`Failed to calculate filter expiry date for row ${rowNum}:`, error);
          }
        }
        // Auto-create asset type if provided
        if (updateData.assetType) {
          await ensureAssetTypeExists(updateData.assetType);
          if (!results.newAssetTypes.includes(updateData.assetType)) {
            results.newAssetTypes.push(updateData.assetType);
          }
        }
        // Auto-create filter type if provided
        if (updateData.filterType) {
          await ensureFilterTypeExists(updateData.filterType);
          if (!results.newFilterTypes.includes(updateData.filterType)) {
            results.newFilterTypes.push(updateData.filterType);
          }
        }
        // Update the asset
        const updateResult = await updateAsset(existingAsset, updateData, userEmail);
        if (updateResult.updated) {
          results.updated++;
          // Log audit entry for this update with detailed field changes
          try {
            // Compare old and new values for all updatable fields
            const updatableFields = [
              'assetType', 'status', 'primaryIdentifier', 'secondaryIdentifier',
              'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
              'filterNeeded', 'filtersOn', 'filterExpiryDate', 'filterInstalledOn',
              'filterType', 'needFlushing', 'notes', 'augmentedCare'
            ];
            const changes = updatableFields
              .filter(field => updateData[field] !== undefined && updateData[field] !== existingAsset[field])
              .map(field => ({
                field,
                oldValue: existingAsset[field],
                newValue: updateData[field]
              }));
            // Always use the correct user, fallback to 'Unknown User' if not available
            const auditUser = userEmail || 'Unknown User';
            // Debug log
            console.log('Bulk update audit log:', {
              assetId: existingAsset.id,
              user: auditUser,
              changes
            });
            await DynamoDBService.logAssetAuditEntry({
              assetId: existingAsset.id,
              timestamp: new Date().toISOString(),
              user: auditUser,
              action: 'UPDATE',
              details: {
                assetBarcode: barcode,
                assetName: updateData.primaryIdentifier || existingAsset.primaryIdentifier || '',
                changes
              }
            });
          } catch (auditError) {
            console.warn(`Failed to log audit entry for asset ${barcode}:`, auditError);
          }
        } else {
          results.errors++;
          results.errorDetails.push(`Row ${rowNum}: ${updateResult.reason || 'Update failed'}`);
        }
      } catch (error) {
        results.errors++;
        results.errorDetails.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error processing row ${rowNum}:`, error);
      }
    }
    return NextResponse.json({
      success: true,
      message: 'Bulk update completed',
      results: {
        total: results.total,
        updated: results.updated,
        skipped: results.skipped,
        notFound: results.notFound,
        errors: results.errors,
        errorDetails: results.errorDetails.slice(0, 20),
        skippedBarcodes: results.skippedBarcodes,
        notFoundBarcodes: results.notFoundBarcodes,
        newAssetTypes: results.newAssetTypes,
        newFilterTypes: results.newFilterTypes
      }
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Bulk update failed'
    }, { status: 500 });
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 