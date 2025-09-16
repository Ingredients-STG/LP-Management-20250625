import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'LPItems';

// GET - Get LP history for specific asset barcode
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetBarcode: string }> }
) {
  try {
    const { assetBarcode } = await params;
    console.log(`Fetching LP history for asset barcode: ${assetBarcode}`);

    // Ensure table exists
    try {
      const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
      await client.send(new DescribeTableCommand({
        TableName: TABLE_NAME
      }));
      console.log(`Table ${TABLE_NAME} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Table ${TABLE_NAME} does not exist yet`);
        return NextResponse.json({
          success: true,
          items: [],
          message: 'No LP history found - table does not exist yet'
        });
      }
      throw error;
    }

    // First, scan for items with exact asset barcode match
    const exactCommand = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'assetBarcode = :assetBarcode',
      ExpressionAttributeValues: {
        ':assetBarcode': assetBarcode
      }
    });

    const exactResult = await docClient.send(exactCommand);
    let items = exactResult.Items || [];
    console.log(`Found ${items.length} exact matches for barcode: ${assetBarcode}`);

    // ALWAYS search for assets that might have this barcode in notes (regardless of exact matches)
    console.log(`Searching for assets with barcode ${assetBarcode} in notes...`);
    
    try {
      // Fetch all assets to search through their notes
      const assetsCommand = new ScanCommand({
        TableName: 'water-tap-assets'
      });
      const assetsResult = await docClient.send(assetsCommand);
      const assets = assetsResult.Items || [];

      // Find assets that have this barcode in their notes
      const matchingAssets = assets.filter(asset => {
        if (!asset.notes) return false;
        const notesText = asset.notes.toLowerCase();
        const searchBarcode = assetBarcode.toLowerCase();
        const barcodeRegex = new RegExp(`\\b${searchBarcode}\\b`, 'i');
        return barcodeRegex.test(notesText);
      });

      if (matchingAssets.length > 0) {
        console.log(`Found ${matchingAssets.length} assets with barcode ${assetBarcode} in notes`);
        
        // Get the current asset barcodes from these matching assets
        const currentBarcodes = matchingAssets.map(asset => asset.assetBarcode).filter(Boolean);
        console.log(`Current barcodes found: ${currentBarcodes.join(', ')}`);
        
        // Search for LP items with these current barcodes
        for (const currentBarcode of currentBarcodes) {
          const historyCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'assetBarcode = :assetBarcode',
            ExpressionAttributeValues: {
              ':assetBarcode': currentBarcode
            }
          });
          
          const historyResult = await docClient.send(historyCommand);
          if (historyResult.Items && historyResult.Items.length > 0) {
            // Only add items that aren't already in the results (avoid duplicates)
            const newItems = historyResult.Items.filter(newItem => 
              !items.some(existingItem => existingItem.id === newItem.id)
            );
            items = items.concat(newItems);
            console.log(`Found ${historyResult.Items.length} LP history items for current barcode: ${currentBarcode} (${newItems.length} new items)`);
          }
        }
      } else {
        console.log(`No assets found with barcode ${assetBarcode} in notes`);
      }
    } catch (assetError) {
      console.warn('Error searching assets for barcode in notes:', assetError);
      // Continue with exact matches only
    }

    // Sort by sampled date (most recent first)
    items.sort((a, b) => {
      const dateA = a.sampledOn ? new Date(a.sampledOn).getTime() : 0;
      const dateB = b.sampledOn ? new Date(b.sampledOn).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });

    console.log(`Found ${items.length} LP history items for asset barcode: ${assetBarcode}`);
    
    // Log each item for debugging
    items.forEach((item, index) => {
      console.log(`LP History Item ${index + 1}:`, {
        id: item.id,
        assetBarcode: item.assetBarcode,
        woNumber: item.woNumber,
        sampleType: item.sampleType,
        testType: item.testType,
        sampledOn: item.sampledOn,
        positiveCountPre: item.positiveCountPre,
        positiveCountPost: item.positiveCountPost
      });
    });

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      assetBarcode,
      message: `Found ${items.length} LP history items`
    });

  } catch (error) {
    console.error('Error fetching LP history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch LP history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
