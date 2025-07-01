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

    // Get headers and normalize them
    const headers = rows[0].map((h: any) => String(h || '').trim().toLowerCase());
    
    // Find required field indices
    const assetBarcodeIndex = headers.findIndex(h => 
      ['assetbarcode', 'asset_barcode', 'barcode'].includes(h)
    );
    const roomIndex = headers.findIndex(h => 
      ['room'].includes(h)
    );
    const filterNeededIndex = headers.findIndex(h => 
      ['filterneeded', 'filter_needed', 'filter needed'].includes(h)
    );
    const filterInstalledOnIndex = headers.findIndex(h => 
      ['filterinstalledon', 'filter_installed_on', 'filter installed on'].includes(h)
    );
    const assetTypeIndex = headers.findIndex(h => 
      ['assettype', 'asset_type', 'asset type', 'type'].includes(h)
    );

    // Get existing assets to check for duplicates
    const existingAssets = await DynamoDBService.getAllAssets();
    const existingBarcodes = new Set(existingAssets.map(asset => asset.assetBarcode));

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
        // Extract required fields
        const assetBarcode = String(values[assetBarcodeIndex] || '').trim();
        const room = String(values[roomIndex] || '').trim();
        const filterNeededValue = String(values[filterNeededIndex] || '').trim().toLowerCase();
        const filterInstalledOnValue = String(values[filterInstalledOnIndex] || '').trim();
        const assetTypeValue = String(values[assetTypeIndex] || '').trim();

        // Validate required fields
        if (!assetBarcode) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Asset Barcode is required`);
          continue;
        }

        if (!room) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Room is required`);
          continue;
        }

        // Parse filterNeeded
        const filterNeeded = ['true', 'yes', '1', 'y'].includes(filterNeededValue);
        
        // Validate filterInstalledOn if filterNeeded is true
        if (filterNeeded && !filterInstalledOnValue) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Filter Installed On date is required when Filter Needed is YES`);
          continue;
        }

        // Check for duplicate barcode
        if (existingBarcodes.has(assetBarcode)) {
          results.failed++;
          results.errors.push(`Row ${rowNumber}: Duplicate barcode ${assetBarcode}`);
          results.duplicateBarcodes.push(assetBarcode);
          continue;
        }

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

        // Build asset object with only provided fields
        const asset: any = {
          assetBarcode,
          room,
          filterNeeded,
          createdBy: 'bulk-upload',
          modifiedBy: 'bulk-upload'
        };

        // Add optional fields if provided
        headers.forEach((header, index) => {
          const value = String(values[index] || '').trim();
          if (!value || index === assetBarcodeIndex || index === roomIndex || index === filterNeededIndex) {
            return; // Skip empty values and already processed required fields
          }

          switch (header) {
            case 'primaryidentifier':
            case 'primary_identifier':
            case 'primary identifier':
              asset.primaryIdentifier = value;
              break;
            case 'secondaryidentifier':
            case 'secondary_identifier':
            case 'secondary identifier':
              asset.secondaryIdentifier = value;
              break;
            case 'assettype':
            case 'asset_type':
            case 'asset type':
            case 'type':
              asset.assetType = value;
              break;
            case 'status':
              asset.status = value;
              break;
            case 'wing':
              asset.wing = value;
              break;
            case 'winginshort':
            case 'wing_in_short':
            case 'wing in short':
              asset.wingInShort = value;
              break;
            case 'floor':
              asset.floor = value;
              break;
            case 'floorinwords':
            case 'floor_in_words':
            case 'floor in words':
              asset.floorInWords = value;
              break;
            case 'roomno':
            case 'room_no':
            case 'room no':
            case 'room number':
              asset.roomNo = value;
              break;
            case 'roomname':
            case 'room_name':
            case 'room name':
              asset.roomName = value;
              break;
            case 'filtersonn':
            case 'filters_on':
            case 'filters on':
              asset.filtersOn = ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
              break;
            case 'filterinstalledon':
            case 'filter_installed_on':
            case 'filter installed on':
              // Parse and validate date
              if (value) {
                try {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    asset.filterInstalledOn = date.toISOString();
                    
                    // Auto-calculate filterExpiryDate (90 days after installation)
                    const expiryDate = new Date(date);
                    expiryDate.setDate(expiryDate.getDate() + 90);
                    asset.filterExpiryDate = expiryDate.toISOString();
                  }
                } catch (error) {
                  console.warn(`Invalid date format for filterInstalledOn in row ${rowNumber}:`, value);
                }
              }
              break;
            case 'notes':
              asset.notes = value;
              break;
            case 'augmentedcare':
            case 'augmented_care':
            case 'augmented care':
              asset.augmentedCare = ['true', 'yes', '1', 'y'].includes(value.toLowerCase());
              break;
            default:
              // Handle any other custom fields
              if (value) {
                asset[header] = value;
              }
              break;
          }
        });

        // Set default values for optional fields if not provided
        if (!asset.status) asset.status = 'ACTIVE';
        if (!asset.primaryIdentifier) asset.primaryIdentifier = assetBarcode;
        if (asset.filterNeeded && !asset.filtersOn) asset.filtersOn = false;

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