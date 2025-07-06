import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getCurrentUser, formatTimestamp } from '@/lib/utils';

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

/**
 * ULTRA-STRICT date parsing supporting ONLY DD/MM/YYYY format
 * Rejects YYYY-MM-DD, MM/DD/YYYY, and any other ambiguous formats
 * Provides clear error messages for user guidance
 */
function parseExcelDate(value: any, rowNum?: number): { date?: string; error?: string } {
  if (!value) return { date: undefined };

  try {
    // Handle Excel serial numbers - convert to DD/MM/YYYY first
    if (typeof value === 'number') {
      const epoch = new Date(Date.UTC(1899, 11, 30)); // Excel base date
      epoch.setDate(epoch.getDate() + value);
      const day = String(epoch.getUTCDate()).padStart(2, '0');
      const month = String(epoch.getUTCMonth() + 1).padStart(2, '0');
      const year = epoch.getUTCFullYear();
      
      // Validate the converted date makes sense
      if (year < 1900 || year > 2100) {
        return { 
          error: `Row ${rowNum}: Invalid date value. Please use DD/MM/YYYY format (e.g., 25/07/2025).` 
        };
      }
      
      return { date: `${year}-${month}-${day}` };
    } 
    // Handle string dates - ULTRA-STRICT DD/MM/YYYY format only
    else if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Check for common wrong formats first with specific error messages
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
        return { 
          error: `Row ${rowNum}: YYYY-MM-DD format detected ("${trimmed}"). Please use DD/MM/YYYY format (e.g., 25/07/2025).` 
        };
      }
      
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
        return { 
          error: `Row ${rowNum}: DD-MM-YYYY format detected ("${trimmed}"). Please use DD/MM/YYYY with forward slashes (e.g., 25/07/2025).` 
        };
      }
      
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
        return { 
          error: `Row ${rowNum}: Single-digit day/month detected ("${trimmed}"). Please use DD/MM/YYYY with zero-padding (e.g., 05/07/2025).` 
        };
      }
      
      // Check for MM/DD/YYYY format (American format)
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [first, second, year] = trimmed.split('/').map(Number);
        
        // Detect likely MM/DD/YYYY format (month > 12 or suspicious patterns)
        if (first > 12 && second <= 12) {
          return { 
            error: `Row ${rowNum}: MM/DD/YYYY format detected ("${trimmed}"). Please use DD/MM/YYYY format (e.g., ${String(second).padStart(2, '0')}/${String(first).padStart(2, '0')}/${year}).` 
          };
        }
        
        // Validate as DD/MM/YYYY
        const day = first;
        const month = second;
        
        // Validate date ranges
        if (month < 1 || month > 12) {
          return { 
            error: `Row ${rowNum}: Invalid month (${month}). Please use DD/MM/YYYY format with valid month (01-12).` 
          };
        }
        
        if (day < 1 || day > 31) {
          return { 
            error: `Row ${rowNum}: Invalid day (${day}). Please use DD/MM/YYYY format with valid day (01-31).` 
          };
        }
        
        if (year < 1900 || year > 2100) {
          return { 
            error: `Row ${rowNum}: Invalid year (${year}). Please use a year between 1900-2100.` 
          };
        }
        
        // Create date and validate it exists (handles Feb 30th, etc.)
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          return { 
            error: `Row ${rowNum}: Invalid date ("${trimmed}"). This date doesn't exist. Please check day/month combination.` 
          };
        }
        
        const isoMonth = String(month).padStart(2, '0');
        const isoDay = String(day).padStart(2, '0');
        return { date: `${year}-${isoMonth}-${isoDay}` };
      }
      // Reject any other format
      else {
        return { 
          error: `Row ${rowNum}: Invalid date format ("${trimmed}"). Please use DD/MM/YYYY format exactly (e.g., 25/07/2025).` 
        };
      }
    }
  } catch (error) {
    return { 
      error: `Row ${rowNum}: Date parsing error. Please use DD/MM/YYYY format (e.g., 25/07/2025).` 
    };
  }
  
  return { 
    error: `Row ${rowNum}: Invalid date value. Please use DD/MM/YYYY format (e.g., 25/07/2025).` 
  };
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

    const results = {
      total: data.length,
      uploaded: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Get existing assets to check for duplicates
    const existingAssets = await ddbClient.send(new ScanCommand({
      TableName: ASSETS_TABLE,
      ProjectionExpression: 'assetBarcode'
    }));
    
    const existingBarcodes = new Set(
      existingAssets.Items?.map(item => item.assetBarcode?.toLowerCase()) || []
    );

    // Get existing asset types
    const existingAssetTypes = await ddbClient.send(new ScanCommand({
      TableName: ASSET_TYPES_TABLE,
      ProjectionExpression: '#label',
      ExpressionAttributeNames: { '#label': 'label' }
    }));
    
    const existingTypeLabels = new Set(
      existingAssetTypes.Items?.map(item => item.label) || []
    );

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Account for header row

      try {
        // Extract required fields with flexible header matching
        const assetBarcode = (
          row['Asset Barcode'] || 
          row['assetBarcode'] || 
          row['asset_barcode'] || 
          row['Barcode'] ||
          row['barcode']
        )?.toString().trim();

        const location = (
          row['Location'] || 
          row['Room'] || 
          row['room'] || 
          row['location']
        )?.toString().trim();

        const filterNeededRaw = (
          row['Filter Needed'] || 
          row['filterNeeded'] || 
          row['filter_needed'] ||
          row['Filter Required']
        )?.toString().toUpperCase();

        const filtersOnRaw = (
          row['Filters On'] || 
          row['filtersOn'] || 
          row['filters_on'] ||
          row['Filter Status']
        )?.toString().toUpperCase();

        const rawInstalled = 
          row['Filter Installed'] || 
          row['filterInstalledOn'] || 
          row['filter_installed_on'] ||
          row['Filter Installed On'];

        const rawExpiry = 
          row['Filter Expiry Date'] || 
          row['filterExpiryDate'] || 
          row['filter_expiry_date'] ||
          row['Filter Expiry'];

        const assetType = (
          row['Asset Type'] || 
          row['assetType'] || 
          row['asset_type'] ||
          row['Type'] ||
          row['type']
        )?.toString().trim();

        // Parse new fields
        const needFlushingRaw = (
          row['Need Flushing'] || 
          row['needFlushing'] || 
          row['need_flushing']
        )?.toString().toUpperCase();

        const filterType = (
          row['Filter Type'] || 
          row['filterType'] || 
          row['filter_type']
        )?.toString().trim();

        const augmentedCareRaw = (
          row['Augmented Care'] || 
          row['augmentedCare'] || 
          row['augmented_care']
        )?.toString().toUpperCase();

        // Validate required fields
        if (!assetBarcode) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Asset Barcode is required`);
          continue;
        }

        if (!location) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Location is required`);
          continue;
        }

        // Check for duplicate barcode (case-insensitive)
        if (existingBarcodes.has(assetBarcode.toLowerCase())) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Barcode '${assetBarcode}' already exists`);
          continue;
        }

        // ===== BULK UPLOAD: STATIC FIELD PROCESSING (NO FILTER LOGIC) =====
        // Parse filter dates - store exactly as provided, NO auto-calculation
        const parsedInstalled = parseExcelDate(rawInstalled, rowNum);
        const parsedExpiry = parseExcelDate(rawExpiry, rowNum);
        
        // Check for date parsing errors
        if (parsedInstalled.error) {
          results.failed++;
          results.errors.push(parsedInstalled.error);
          continue;
        }
        
        if (parsedExpiry.error) {
          results.failed++;
          results.errors.push(parsedExpiry.error);
          continue;
        }

        // Parse all boolean fields independently - NO interdependencies or logic
        // Filter logic is ONLY applied in Add/Edit Asset UI, NOT during bulk upload
        function parseBoolField(val: string | undefined): boolean {
          if (!val) return false;
          return ['YES', 'TRUE', '1', 'Y'].includes(val.trim().toUpperCase());
        }
        const filterNeeded = parseBoolField(filterNeededRaw);
        const filtersOn = parseBoolField(filtersOnRaw);
        const needFlushing = parseBoolField(needFlushingRaw);
        const augmentedCare = parseBoolField(augmentedCareRaw);
        
        // ===== FILTER STATUS MISMATCH DETECTION =====
        // Check for potential mismatches between uploaded Filters On and expected logic
        // This is informational only - we still store the uploaded value as-is
        if (filtersOnRaw && filterNeededRaw) {
          // If Filters On is YES but Filter Needed is also YES, this might be inconsistent
          if (filtersOn && filterNeeded) {
            results.errors.push(`Row ${rowNum}: MISMATCH DETECTED - 'Filters On' is YES but 'Filter Needed' is also YES. Please review asset entry for ${assetBarcode}.`);
          }
          // If Filters On is NO but there's a recent filter installation, this might be inconsistent
          if (!filtersOn && parsedInstalled.date) {
            const installedDate = new Date(parsedInstalled.date);
            const daysSinceInstallation = (Date.now() - installedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceInstallation < 30) { // Less than 30 days ago
              results.errors.push(`Row ${rowNum}: MISMATCH DETECTED - 'Filters On' is NO but filter was recently installed (${Math.round(daysSinceInstallation)} days ago). Please review asset entry for ${assetBarcode}.`);
            }
          }
        }
        
        // Store dates exactly as provided - NO auto-calculation of Filter Expiry
        // Auto-calculation only happens in manual Add/Edit Asset forms
        const filterInstalledOn = parsedInstalled.date || '';
        const filterExpiryDate = parsedExpiry.date || '';

        // Auto-create asset type if provided and doesn't exist
        if (assetType && !existingTypeLabels.has(assetType)) {
          try {
            await ddbClient.send(new PutCommand({
              TableName: ASSET_TYPES_TABLE,
              Item: { 
                typeId: `type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                label: assetType,
                createdBy: 'csv-upload',
                createdAt: new Date().toISOString()
              },
              ConditionExpression: 'attribute_not_exists(#label)',
              ExpressionAttributeNames: { '#label': 'label' }
            }));
            existingTypeLabels.add(assetType);
          } catch (err) {
            // Ignore if already exists (race condition)
            console.warn(`Asset type '${assetType}' may already exist:`, err);
          }
        }

        // Create asset record
        const assetId = `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const currentUser = getCurrentUser();

        const assetData = {
          id: assetId,
          assetBarcode,
          room: location, // Using 'room' field as per existing schema
          assetType: assetType || '',
          filterNeeded,
          filterInstalledOn,
          filterExpiryDate,
          filtersOn,
          needFlushing,
          filterType: filterType || '',
          status: 'ACTIVE',
          primaryIdentifier: assetBarcode, // Default to barcode
          secondaryIdentifier: '',
          wing: '',
          wingInShort: '',
          floor: '',
          floorInWords: '',
          roomNo: '',
          roomName: '',
          notes: '',
          augmentedCare,
          created: now,
          createdBy: currentUser,
          modified: now,
          modifiedBy: currentUser
        };

        await ddbClient.send(new PutCommand({
          TableName: ASSETS_TABLE,
          Item: assetData
        }));

        // Add to existing barcodes to prevent duplicates within same upload
        existingBarcodes.add(assetBarcode.toLowerCase());
        results.uploaded++;

      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error processing row ${rowNum}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        total: results.total,
        uploaded: results.uploaded,
        failed: results.failed,
        errors: results.errors.slice(0, 20) // Limit to first 20 errors
      }
    });

  } catch (err) {
    console.error('CSV Upload Error:', err);
    return NextResponse.json({ 
      success: false,
      error: 'Upload failed. Please try again.' 
    }, { status: 500 });
  }
} 