import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';
import * as XLSX from 'xlsx';

interface BulkUploadResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  duplicateBarcodes: string[];
  newAssetTypes: string[];
  newFilterTypes: string[];
}

// Header normalization function
function normalizeHeader(header: string): string {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[*\s_-]+/g, '') // Remove asterisks, spaces, underscores, hyphens
    .replace(/[^\w]/g, ''); // Remove any remaining non-word characters
}

// Create header mapping for field identification
function createHeaderMapping(headers: string[]): { [key: string]: number } {
  const mapping: { [key: string]: number } = {};
  
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    
    // Map various header formats to standard field names
    const fieldMappings: { [key: string]: string[] } = {
      'assetBarcode': ['assetbarcode', 'asset_barcode', 'assetbarcode*', 'barcode', 'assetcode'],
      'room': ['room', 'room*', 'roomlocation', 'location'],
      'filterNeeded': ['filterneeded', 'filterneeded*', 'filter_needed', 'filterrequired', 'needsfilter'],
      'filterInstalledOn': ['filterinstalledon', 'filter_installed_on', 'filterinstalldate', 'installdate'],
      'assetType': ['assettype', 'asset_type', 'type', 'category', 'equipmenttype'],
      'primaryIdentifier': ['primaryidentifier', 'primary_identifier', 'primaryid', 'mainid'],
      'secondaryIdentifier': ['secondaryidentifier', 'secondary_identifier', 'secondaryid', 'altid'],
      'status': ['status', 'state', 'condition'],
      'wing': ['wing', 'building', 'block'],
      'wingInShort': ['winginshort', 'wing_in_short', 'wingshort', 'buildingshort'],
      'floor': ['floor', 'level', 'storey'],
      'floorInWords': ['floorinwords', 'floor_in_words', 'floorwords', 'levelwords'],
      'roomNo': ['roomno', 'room_no', 'roomnumber', 'room_number'],
      'roomName': ['roomname', 'room_name', 'roomtitle', 'room_title'],
      'filtersOn': ['filterson', 'filters_on', 'filtersactive', 'filtersstatus'],
      'notes': ['notes', 'comments', 'remarks', 'description'],
      'augmentedCare': ['augmentedcare', 'augmented_care', 'specialcare', 'enhanced'],
      'needFlushing': ['needflushing', 'need_flushing', 'need_flushing*', 'needflushing*'],
      'filterType': ['filtertype', 'filter_type', 'filter_type*']
    };

    // Find matching field for this header
    for (const [fieldName, variations] of Object.entries(fieldMappings)) {
      if (variations.includes(normalized)) {
        mapping[fieldName] = index;
        break;
      }
    }
  });

  return mapping;
}

// Add robust boolean parsing helper
function parseBoolField(val: string | undefined): boolean {
  if (!val) return false;
  return ['YES', 'TRUE', '1', 'Y'].includes(val.trim().toUpperCase());
}

// Field sanitization function
function sanitizeField(value: any, fieldName: string): any {
  if (value === null || value === undefined) return value;
  
  const stringValue = String(value).trim();
  
  // Special handling for asset barcode - always uppercase
  if (fieldName === 'assetBarcode') {
    return stringValue.toUpperCase();
  }
  
  return stringValue;
}

// Strict DD/MM/YYYY date parsing (copied from csv-upload)
function parseExcelDate(value: any, rowNum?: number): { date?: string; error?: string } {
  if (!value) return { date: undefined };
  try {
    if (typeof value === 'number') {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setDate(epoch.getDate() + value);
      const day = String(epoch.getUTCDate()).padStart(2, '0');
      const month = String(epoch.getUTCMonth() + 1).padStart(2, '0');
      const year = epoch.getUTCFullYear();
      if (year < 1900 || year > 2100) {
        return { error: `Row ${rowNum}: Invalid date value. Please use DD/MM/YYYY format (e.g., 25/07/2025).` };
      }
      return { date: `${year}-${month}-${day}` };
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        return { date: `${year}-${month}-${day}` };
      }
      // fallback to ISO or other formats
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const isoMonth = String(d.getMonth() + 1).padStart(2, '0');
        const isoDay = String(d.getDate()).padStart(2, '0');
        return { date: `${d.getFullYear()}-${isoMonth}-${isoDay}` };
      }
      return { error: `Row ${rowNum}: Invalid date format ("${trimmed}"). Please use DD/MM/YYYY format.` };
    }
  } catch {
    return { error: `Row ${rowNum}: Date parsing error. Please use DD/MM/YYYY format.` };
  }
  return { error: `Row ${rowNum}: Invalid date value. Please use DD/MM/YYYY format.` };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');
    
    if (!isExcel && !isCsv) {
      return NextResponse.json({ 
        success: false, 
        error: 'Only CSV and Excel (.xlsx, .xls) files are supported' 
      }, { status: 400 });
    }

    // Parse file content
    const buffer = await file.arrayBuffer();
    let rows: any[][] = [];

    if (isExcel) {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    } else {
      // Parse CSV file
      const content = new TextDecoder().decode(buffer);
      const lines = content.split('\n').filter(line => line.trim());
      rows = lines.map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')));
    }

    if (rows.length < 2) {
      return NextResponse.json({ 
        success: false, 
        error: 'File must contain at least a header row and one data row' 
      }, { status: 400 });
    }

    // Normalize headers and create field mapping
    const rawHeaders = rows[0].map((h: any) => String(h || '').trim());
    const headerMapping = createHeaderMapping(rawHeaders);
    
    // Debug log header mapping
    console.log('Raw headers:', rawHeaders);
    console.log('Header mapping:', headerMapping);
    
    // Only assetBarcode is required
    const requiredFields = ['assetBarcode'];
    const missingFields = requiredFields.filter(field => !(field in headerMapping));
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required columns: ${missingFields.join(', ')}. Please ensure your file has a column for Asset Barcode.`
      }, { status: 400 });
    }

    // Get existing assets to check for duplicates
    const existingAssets = await DynamoDBService.getAllAssets();
    const existingBarcodes = new Set(existingAssets.map(asset => asset.assetBarcode?.trim()).filter(Boolean));

    // Get existing asset types
    const existingAssetTypes = await DynamoDBService.getAllAssetTypes();
    const existingTypeLabels = new Set(existingAssetTypes.map(type => type.label));

    const results: BulkUploadResult = {
      total: rows.length - 1,
      success: 0,
      failed: 0,
      errors: [],
      duplicateBarcodes: [],
      newAssetTypes: [],
      newFilterTypes: []
    };

    // Process each data row with timeout protection
    const startTime = Date.now();
    const maxProcessingTime = 25000; // 25 seconds max processing time

    for (let i = 1; i < rows.length; i++) {
      // Check for timeout
      if (Date.now() - startTime > maxProcessingTime) {
        results.failed++;
        results.errors.push(`Processing timeout after ${i} rows. Please try with a smaller file.`);
        break;
      }

      const rowNumber = i + 1;
      const values = rows[i];
      
      try {
        // Extract and validate required fields
        const assetBarcodeRaw = values[headerMapping.assetBarcode] || '';
        const assetBarcode = sanitizeField(assetBarcodeRaw, 'assetBarcode');
        
        // Validate Asset Barcode
        if (!assetBarcode || assetBarcode === 'null' || assetBarcode === 'undefined') {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Asset Barcode is required`);
          continue;
        }

        // Check for duplicate barcode (case-insensitive)
        const duplicateFound = Array.from(existingBarcodes).some(existing => 
          existing.toLowerCase() === assetBarcode.toLowerCase()
        );
        
        if (duplicateFound) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Duplicate barcode ${assetBarcode}`);
          results.duplicateBarcodes.push(assetBarcode);
          continue;
        }

        // Get asset type for auto-creation
        const assetTypeRaw = headerMapping.assetType !== undefined ? values[headerMapping.assetType] : '';
        // Normalize assetType and filterType
        const assetTypeValue = String(assetTypeRaw).trim();
        const normalizedAssetType = assetTypeValue ? assetTypeValue.toLowerCase() : '';

        // Auto-create asset type if provided and doesn't exist (case-insensitive)
        if (normalizedAssetType && !Array.from(existingTypeLabels).map(t => t.toLowerCase()).includes(normalizedAssetType)) {
          try {
            await DynamoDBService.createAssetType(assetTypeValue, 'bulk-upload');
            existingTypeLabels.add(assetTypeValue);
            results.newAssetTypes.push(assetTypeValue);
          } catch (error) {
            console.warn(`Failed to create asset type ${assetTypeValue}:`, error);
          }
        }

        // Parse filterType and auto-create if new
        const filterTypeRaw = headerMapping.filterType !== undefined ? values[headerMapping.filterType] : '';
        const filterType = String(filterTypeRaw).trim();
        const normalizedFilterType = filterType ? filterType.toLowerCase() : '';
        if (normalizedFilterType) {
          try {
            const { DynamoDBDocumentClient, PutCommand } = await import('@aws-sdk/lib-dynamodb');
            const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
            const client = new DynamoDBClient({
              region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
              credentials: {
                accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
              },
            });
            const ddbClient = DynamoDBDocumentClient.from(client);
            // Check if filter type already exists (case-insensitive)
            const filterTypesResult = await ddbClient.send(new (await import('@aws-sdk/lib-dynamodb')).ScanCommand({
              TableName: 'FilterTypes',
              ProjectionExpression: '#label',
              ExpressionAttributeNames: { '#label': 'label' },
            }));
            const existingFilterTypes = (filterTypesResult.Items || []).map((item: any) => item.label?.toLowerCase());
            if (!existingFilterTypes.includes(normalizedFilterType)) {
              const typeId = `filter-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              await ddbClient.send(new PutCommand({
                TableName: 'FilterTypes',
                Item: {
                  typeId,
                  label: filterType,
                  createdAt: new Date().toISOString(),
                  createdBy: 'bulk-upload'
                },
                ConditionExpression: 'attribute_not_exists(#label)',
                ExpressionAttributeNames: { '#label': 'label' }
              }));
              results.newFilterTypes.push(filterType);
            }
          } catch (error: any) {
            if (error.name !== 'ConditionalCheckFailedException') {
              console.warn(`Failed to create filter type ${filterType}:`, error);
            }
          }
        }

        // Build asset object (all other fields optional)
        const asset: any = { assetBarcode, createdBy: 'bulk-upload', modifiedBy: 'bulk-upload' };
        const optionalFields = [
          'room', 'filterNeeded', 'filterInstalledOn', 'assetType', 'primaryIdentifier', 'secondaryIdentifier', 'status',
          'wing', 'wingInShort', 'floor', 'floorInWords', 'roomNo', 'roomName', 'filtersOn', 'needFlushing', 'filterType',
          'notes', 'augmentedCare', 'filterExpiryDate'
        ];
        optionalFields.forEach(fieldName => {
          if (fieldName in headerMapping) {
            const rawValue = values[headerMapping[fieldName]];
            const value = sanitizeField(rawValue, fieldName);
            if (value !== null && value !== undefined && value !== '' && value !== 'null' && value !== 'undefined') {
              asset[fieldName] = value;
            }
          }
        });

        // Save to DynamoDB
        const newAsset = await DynamoDBService.createAsset(asset);
        existingBarcodes.add(assetBarcode);
        results.success++;

        // Log audit entry for this asset
        try {
          await DynamoDBService.logAssetAuditEntry({
            assetId: newAsset.id,
            timestamp: new Date().toISOString(),
            user: 'bulk-upload',
            action: 'CREATE',
            details: { assetBarcode, assetName: asset.primaryIdentifier || '', changes: [] }
          });
        } catch (auditError) {
          console.warn(`Failed to log audit entry for asset ${assetBarcode}:`, auditError);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      results: {
        total: results.total,
        uploaded: results.success,
        skipped: results.duplicateBarcodes.length,
        failed: results.failed,
        errors: results.errors.slice(0, 20), // Show up to 20 errors
        duplicateBarcodes: [...new Set(results.duplicateBarcodes)], // Remove duplicates
        newAssetTypes: [...new Set(results.newAssetTypes)], // Remove duplicates
        newFilterTypes: [...new Set(results.newFilterTypes)] // Remove duplicates
      }
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv'; // csv or excel

    // Generate template with only required fields marked
    const headers = [
      'assetBarcode*',      // Required
      'room*',              // Required  
      'filterNeeded*',      // Required (YES/NO)
      'filterInstalledOn',  // Required only if filterNeeded is YES
      'assetType',          // Optional - will auto-create if new
      'primaryIdentifier',  // Optional
      'secondaryIdentifier', // Optional
      'status',             // Optional
      'wing',               // Optional
      'wingInShort',        // Optional
      'floor',              // Optional
      'floorInWords',       // Optional
      'roomNo',             // Optional
      'roomName',           // Optional
      'filtersOn',          // Optional
      'needFlushing',       // Optional
      'filterType',         // Optional - will auto-create if new
      'notes',              // Optional
      'augmentedCare'       // Optional
    ];

    // Create sample data showing required vs optional fields
    const sampleData = [
      'B30674',           // assetBarcode* (required)
      'Room 101',         // room* (required)
      'YES',              // filterNeeded* (required - YES/NO)
      '01/01/2024',       // filterInstalledOn (DD/MM/YYYY format)
      'Water Tap',        // assetType (optional - will auto-create)
      'TAP001',           // primaryIdentifier (optional)
      'SEC001',           // secondaryIdentifier (optional)
      'ACTIVE',           // status (optional)
      'North Wing',       // wing (optional)
      'NW',               // wingInShort (optional)
      'Ground Floor',     // floor (optional)
      'Ground',           // floorInWords (optional)
      '101',              // roomNo (optional)
      'Staff Room',       // roomName (optional)
      'YES',              // filtersOn (optional)
      'NO',               // needFlushing (optional)
      'Standard',         // filterType (optional)
      'Sample notes',     // notes (optional)
      'NO'                // augmentedCare (optional)
    ];

    if (format === 'excel') {
      // Create Excel workbook
      const workbook = XLSX.utils.book_new();
      
      // Create worksheet data
      const worksheetData = [headers, sampleData];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Set column widths for better readability
      const columnWidths = headers.map(header => ({ width: Math.max(header.length, 15) }));
      worksheet['!cols'] = columnWidths;
      
      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
      
      // Generate Excel file
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const filename = `bulk-upload-template-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    } else {
      // Generate CSV
      const csvContent = headers.join(',') + '\n' + sampleData.join(',');
      const filename = `bulk-upload-template-${new Date().toISOString().split('T')[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate template' 
    }, { status: 500 });
  }
} 