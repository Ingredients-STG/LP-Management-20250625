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
      'filtersOn': ['filtersonn', 'filters_on', 'filtersactive', 'filtersstatus'],
      'notes': ['notes', 'comments', 'remarks', 'description'],
      'augmentedCare': ['augmentedcare', 'augmented_care', 'specialcare', 'enhanced']
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
    
    // Check for required field presence
    const requiredFields = ['assetBarcode', 'room', 'filterNeeded'];
    const missingFields = requiredFields.filter(field => !(field in headerMapping));
    
    if (missingFields.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Missing required columns: ${missingFields.join(', ')}. Please ensure your file has columns for Asset Barcode, Room, and Filter Needed.`
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
      newAssetTypes: []
    };

    // Process each data row
    for (let i = 1; i < rows.length; i++) {
      const rowNumber = i + 1;
      const values = rows[i];
      
      try {
        // Extract and validate required fields
        const assetBarcodeRaw = values[headerMapping.assetBarcode] || '';
        const assetBarcode = String(assetBarcodeRaw).trim();
        
        const roomRaw = values[headerMapping.room] || '';
        const room = String(roomRaw).trim();
        
        const filterNeededRaw = values[headerMapping.filterNeeded] || '';
        const filterNeededValue = String(filterNeededRaw).trim().toLowerCase();

        // Validate Asset Barcode
        if (!assetBarcode || assetBarcode === 'null' || assetBarcode === 'undefined') {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Asset Barcode is required`);
          continue;
        }

        // Validate Room
        if (!room || room === 'null' || room === 'undefined') {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Room is required`);
          continue;
        }

        // Validate Filter Needed
        if (!filterNeededValue) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Filter Needed is required (use YES/NO)`);
          continue;
        }

        // Parse filterNeeded
        const filterNeeded = ['true', 'yes', '1', 'y'].includes(filterNeededValue);
        
        // Validate filterInstalledOn if filterNeeded is true
        const filterInstalledOnRaw = values[headerMapping.filterInstalledOn] || '';
        const filterInstalledOnValue = String(filterInstalledOnRaw).trim();
        
        if (filterNeeded && !filterInstalledOnValue) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Filter Installed On date is required when Filter Needed is YES`);
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
        const assetTypeRaw = values[headerMapping.assetType] || '';
        const assetTypeValue = String(assetTypeRaw).trim();

        // Auto-create asset type if provided and doesn't exist
        if (assetTypeValue && !existingTypeLabels.has(assetTypeValue)) {
          try {
            await DynamoDBService.createAssetType(assetTypeValue, 'bulk-upload');
            existingTypeLabels.add(assetTypeValue);
            results.newAssetTypes.push(assetTypeValue);
          } catch (error) {
            console.warn(`Failed to create asset type ${assetTypeValue}:`, error);
          }
        }

        // Build asset object with validated required fields
        const asset: any = {
          assetBarcode,
          room,
          filterNeeded,
          createdBy: 'bulk-upload',
          modifiedBy: 'bulk-upload'
        };

        // Add optional fields using header mapping
        const optionalFields = [
          'primaryIdentifier', 'secondaryIdentifier', 'assetType', 'status',
          'wing', 'wingInShort', 'floor', 'floorInWords', 'roomNo', 'roomName',
          'filtersOn', 'notes', 'augmentedCare'
        ];

        optionalFields.forEach(fieldName => {
          if (fieldName in headerMapping) {
            const value = String(values[headerMapping[fieldName]] || '').trim();
            if (value && value !== 'null' && value !== 'undefined') {
              
              // Handle special field types
              if (fieldName === 'filtersOn' || fieldName === 'augmentedCare') {
                asset[fieldName] = ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
              } else {
                asset[fieldName] = value;
              }
            }
          }
        });

        // Handle filterInstalledOn with date parsing and expiry calculation
        if (filterInstalledOnValue) {
          try {
            const date = new Date(filterInstalledOnValue);
            if (!isNaN(date.getTime())) {
              asset.filterInstalledOn = date.toISOString();
              
              // Auto-calculate filterExpiryDate (90 days after installation)
              const expiryDate = new Date(date);
              expiryDate.setDate(expiryDate.getDate() + 90);
              asset.filterExpiryDate = expiryDate.toISOString();
            } else {
              results.failed++;
              results.errors.push(`Row ${rowNumber}: Invalid date format for Filter Installed On: ${filterInstalledOnValue}`);
              continue;
            }
          } catch (error) {
            results.failed++;
            results.errors.push(`Row ${rowNumber}: Invalid date format for Filter Installed On: ${filterInstalledOnValue}`);
            continue;
          }
        }

        // Set default values for optional fields if not provided
        if (!asset.status) asset.status = 'ACTIVE';
        if (!asset.primaryIdentifier) asset.primaryIdentifier = assetBarcode;
        if (asset.filterNeeded && !asset.hasOwnProperty('filtersOn')) asset.filtersOn = false;

        // Save to DynamoDB
        const newAsset = await DynamoDBService.createAsset(asset);
        
        // Add to existing barcodes to prevent duplicates within the same upload
        existingBarcodes.add(assetBarcode);
        
        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      results: {
        total: results.total,
        success: results.success,
        failed: results.failed,
        errors: results.errors.slice(0, 20), // Show up to 20 errors
        duplicateBarcodes: [...new Set(results.duplicateBarcodes)], // Remove duplicates
        newAssetTypes: [...new Set(results.newAssetTypes)] // Remove duplicates
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

export async function GET() {
  try {
    // Generate updated CSV template with only required fields marked
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
      'notes',              // Optional
      'augmentedCare'       // Optional
    ];

    // Create sample data showing required vs optional fields
    const sampleData = [
      'B30674',           // assetBarcode* (required)
      'Room 101',         // room* (required)
      'YES',              // filterNeeded* (required - YES/NO)
      '2024-10-01',       // filterInstalledOn (required if filterNeeded=YES)
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
      'NO',               // filtersOn (optional)
      'Sample notes',     // notes (optional)
      'NO'                // augmentedCare (optional)
    ];

    const csvContent = headers.join(',') + '\n' + sampleData.join(',');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="asset_bulk_upload_template.csv"'
      }
    });

  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate template' 
    }, { status: 500 });
  }
} 