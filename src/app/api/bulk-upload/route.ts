import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const buffer = await file.arrayBuffer();
    const content = new TextDecoder().decode(buffer);
    
    // Parse CSV content
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'File must contain at least a header row and one data row' }, { status: 400 });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length !== headers.length) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Column count mismatch`);
          continue;
        }

        // Create asset object
        const asset: any = {
          created: new Date().toISOString(),
          createdBy: 'bulk-upload',
          modified: new Date().toISOString(),
          modifiedBy: 'bulk-upload'
        };

        // Map CSV columns to asset properties
        headers.forEach((header, index) => {
          const value = values[index];
          switch (header.toLowerCase()) {
            case 'assetbarcode':
            case 'asset_barcode':
              asset.assetBarcode = value;
              break;
            case 'primaryidentifier':
            case 'primary_identifier':
              asset.primaryIdentifier = value;
              break;
            case 'secondaryidentifier':
            case 'secondary_identifier':
              asset.secondaryIdentifier = value;
              break;
            case 'assettype':
            case 'asset_type':
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
              asset.wingInShort = value;
              break;
            case 'room':
              asset.room = value;
              break;
            case 'floor':
              asset.floor = value;
              break;
            case 'floorinwords':
            case 'floor_in_words':
              asset.floorInWords = value;
              break;
            case 'roomno':
            case 'room_no':
              asset.roomNo = value;
              break;
            case 'roomname':
            case 'room_name':
              asset.roomName = value;
              break;
            case 'filterneeded':
            case 'filter_needed':
              asset.filterNeeded = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
              break;
            case 'filtersonn':
            case 'filters_on':
              asset.filtersOn = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
              break;
            case 'filterexpirydate':
            case 'filter_expiry_date':
              asset.filterExpiryDate = value;
              break;
            case 'filterinstalledon':
            case 'filter_installed_on':
              asset.filterInstalledOn = value;
              break;
            case 'notes':
              asset.notes = value;
              break;
            case 'augmentedcare':
            case 'augmented_care':
              asset.augmentedCare = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
              break;
            default:
              // Handle custom fields
              asset[header] = value;
              break;
          }
        });

        // Validate required fields
        if (!asset.assetBarcode || !asset.primaryIdentifier || !asset.assetType || !asset.status) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: Missing required fields (assetBarcode, primaryIdentifier, assetType, status)`);
          continue;
        }

        // Save to DynamoDB
        await DynamoDBService.createAsset(asset);
        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      results: {
        total: lines.length - 1,
        success: results.success,
        failed: results.failed,
        errors: results.errors.slice(0, 10) // Limit to first 10 errors
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
    // Generate Excel template
    const headers = [
      'assetBarcode',
      'primaryIdentifier', 
      'secondaryIdentifier',
      'assetType',
      'status',
      'wing',
      'wingInShort',
      'room',
      'floor',
      'floorInWords',
      'roomNo',
      'roomName',
      'filterNeeded',
      'filtersOn',
      'filterExpiryDate',
      'filterInstalledOn',
      'notes',
      'augmentedCare'
    ];

    const csvContent = headers.join(',') + '\n' + 
      'B30674,TAP001,SEC001,Water Tap,ACTIVE,North Wing,NW,Room 101,Ground Floor,Ground,101,Staff Room,true,false,2024-12-31,2024-10-01,Sample notes,false';

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="asset_template.csv"'
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