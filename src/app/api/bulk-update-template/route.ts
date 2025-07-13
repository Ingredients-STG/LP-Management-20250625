import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

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

/**
 * Format date for display (YYYY-MM-DD to DD/MM/YYYY)
 */
function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateString; // Return original if parsing fails
  }
}

/**
 * Format boolean for display
 */
function formatBooleanForDisplay(value: any): string {
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'false') return lower.toUpperCase();
  }
  return value ? 'TRUE' : 'FALSE';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv'; // csv or excel
    const includeData = searchParams.get('includeData') === 'true';

    // Get all assets from DynamoDB
    let assets: any[] = [];
    
    if (includeData) {
      let lastEvaluatedKey: any = undefined;
      
      do {
      const scanCommand = new ScanCommand({
        TableName: ASSETS_TABLE,
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100 // Process in batches to avoid memory issues
      });
      
      const result = await ddbClient.send(scanCommand);
        
        if (result.Items && result.Items.length > 0) {
          assets.push(...result.Items);
          console.log(`Fetched ${result.Items.length} assets for template (total so far: ${assets.length})`);
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
      } while (lastEvaluatedKey);
      
      console.log(`Total assets fetched for template: ${assets.length}`);
    }

    // Define all possible columns based on the asset schema
    const columns = [
      'Asset Barcode',
      'Asset Type',
      'Status',
      'Primary Identifier',
      'Secondary Identifier',
      'Wing',
      'Wing In Short',
      'Room',
      'Floor',
      'Floor In Words',
      'Room No',
      'Room Name',
      'Filter Needed',
      'Filters On',
      'Filter Expiry Date',
      'Filter Installed On',
      'Filter Type',
      'Need Flushing',
      'Notes',
      'Augmented Care'
    ];

    // Create template data
    const templateData: any[] = [];

    if (includeData && assets.length > 0) {
      // Include existing asset data
      for (const asset of assets) {
        const row: any = {};
        
        // Map database fields to CSV columns
        row['Asset Barcode'] = asset.assetBarcode || '';
        row['Asset Type'] = asset.assetType || '';
        row['Status'] = asset.status || '';
        row['Primary Identifier'] = asset.primaryIdentifier || '';
        row['Secondary Identifier'] = asset.secondaryIdentifier || '';
        row['Wing'] = asset.wing || '';
        row['Wing In Short'] = asset.wingInShort || '';
        row['Room'] = asset.room || '';
        row['Floor'] = asset.floor || '';
        row['Floor In Words'] = asset.floorInWords || '';
        row['Room No'] = asset.roomNo || '';
        row['Room Name'] = asset.roomName || '';
        row['Filter Needed'] = formatBooleanForDisplay(asset.filterNeeded);
        row['Filters On'] = formatBooleanForDisplay(asset.filtersOn);
        row['Filter Expiry Date'] = formatDateForDisplay(asset.filterExpiryDate);
        row['Filter Installed On'] = formatDateForDisplay(asset.filterInstalledOn);
        row['Filter Type'] = asset.filterType || '';
        row['Need Flushing'] = formatBooleanForDisplay(asset.needFlushing);
        row['Notes'] = asset.notes || '';
        row['Augmented Care'] = formatBooleanForDisplay(asset.augmentedCare);
        
        templateData.push(row);
      }
    } else {
      // Create empty template with sample data
      const sampleRow: any = {};
      
      sampleRow['Asset Barcode'] = 'SAMPLE-001';
      sampleRow['Asset Type'] = 'Water Tap';
      sampleRow['Status'] = 'ACTIVE';
      sampleRow['Primary Identifier'] = 'Main Water Tap';
      sampleRow['Secondary Identifier'] = 'Kitchen Area';
      sampleRow['Wing'] = 'North Wing';
      sampleRow['Wing In Short'] = 'NW';
      sampleRow['Room'] = 'Kitchen';
      sampleRow['Floor'] = 'Ground Floor';
      sampleRow['Floor In Words'] = 'Ground';
      sampleRow['Room No'] = '101';
      sampleRow['Room Name'] = 'Main Kitchen';
      sampleRow['Filter Needed'] = 'TRUE';
      sampleRow['Filters On'] = 'TRUE';
      sampleRow['Filter Expiry Date'] = '31/12/2024';
      sampleRow['Filter Installed On'] = '01/01/2024';
      sampleRow['Filter Type'] = 'Standard';
      sampleRow['Need Flushing'] = 'FALSE';
      sampleRow['Notes'] = 'Sample notes here';
      sampleRow['Augmented Care'] = 'FALSE';
      
      templateData.push(sampleRow);
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData, { header: columns });

    // Set column widths for better readability
    const columnWidths = columns.map(col => ({ width: Math.max(col.length, 15) }));
    worksheet['!cols'] = columnWidths;

    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');

    // Generate file based on format
    let buffer: Buffer;
    let filename: string;
    let contentType: string;

    if (format === 'excel') {
      buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      filename = `bulk-update-template-${new Date().toISOString().split('T')[0]}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'csv' });
      filename = `bulk-update-template-${new Date().toISOString().split('T')[0]}.csv`;
      contentType = 'text/csv';
    }

    // Return the file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error generating bulk update template:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate template'
    }, { status: 500 });
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 