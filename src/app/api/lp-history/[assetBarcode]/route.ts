import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '@/lib/dynamodb';

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

    // Search for related barcodes to get complete LP history
    console.log(`Searching for related barcodes to get complete LP history for ${assetBarcode}...`);
    
    try {
      // Fetch all assets using the same service as the Assets API to ensure consistency
      console.log('Fetching all assets using DynamoDBService...');
      const assets = await DynamoDBService.getAllAssets();

      // Collect all related barcodes (current + historical)
      const relatedBarcodes = new Set([assetBarcode]); // Start with the searched barcode

      // Method 1: Find assets that have the searched barcode in their notes
      // This handles cases where the searched barcode is an old barcode mentioned in notes
      console.log(`Searching for assets with barcode ${assetBarcode} in notes...`);
      const assetsWithBarcodeInNotes = assets.filter(asset => {
        if (!asset.notes) return false;
        const notesText = asset.notes.toLowerCase();
        const searchBarcode = assetBarcode.toLowerCase();
        const barcodeRegex = new RegExp(`\\b${searchBarcode}\\b`, 'i');
        return barcodeRegex.test(notesText);
      });

      if (assetsWithBarcodeInNotes.length > 0) {
        console.log(`Found ${assetsWithBarcodeInNotes.length} assets with barcode ${assetBarcode} in notes`);
        
        // Add the current barcodes of these assets
        assetsWithBarcodeInNotes.forEach(asset => {
          if (asset.assetBarcode) {
            relatedBarcodes.add(asset.assetBarcode);
            console.log(`Added current barcode from notes search: ${asset.assetBarcode}`);
          }
        });
      } else {
        console.log(`No assets found with barcode ${assetBarcode} in notes`);
      }

      // Method 2: Find the asset with the searched barcode as current barcode
      // and extract all historical barcodes from its notes
      console.log(`Searching for asset with current barcode ${assetBarcode} and extracting historical barcodes from notes...`);
      
      console.log(`DEBUG: Total assets found in DynamoDB: ${assets.length}`);
      console.log(`DEBUG: Looking for asset with barcode: ${assetBarcode}`);
      
      // Debug: Log first few assets to see the structure
      if (assets.length > 0) {
        console.log(`DEBUG: Sample asset structure:`, {
          assetBarcode: assets[0].assetBarcode,
          id: assets[0].id,
          hasNotes: !!assets[0].notes
        });
      }
      
      const currentAsset = assets.find(asset => asset.assetBarcode === assetBarcode);
      console.log(`DEBUG: Found current asset:`, currentAsset ? {
        assetBarcode: currentAsset.assetBarcode,
        id: currentAsset.id,
        notes: currentAsset.notes ? currentAsset.notes.substring(0, 100) + '...' : 'No notes'
      } : 'null');
      
      if (currentAsset && currentAsset.notes) {
        console.log(`Found asset with current barcode ${assetBarcode}, extracting historical barcodes from notes...`);
        
        // Extract all barcodes from the notes (format: B followed by 5 digits)
        const barcodeRegex = /\bB\d{5}\b/g;
        const notesBarcodes = currentAsset.notes.match(barcodeRegex) || [];
        const uniqueNotesBarcodes = [...new Set(notesBarcodes)]; // Remove duplicates
        
        if (uniqueNotesBarcodes.length > 0) {
          console.log(`Found historical barcodes in notes: ${uniqueNotesBarcodes.join(', ')}`);
          
          // Add all historical barcodes found in notes
          uniqueNotesBarcodes.forEach(barcode => {
            relatedBarcodes.add(barcode);
          });
        } else {
          console.log(`No historical barcodes found in notes for asset ${assetBarcode}`);
        }
      } else {
        console.log(`No asset found with current barcode ${assetBarcode}`);
      }

      // Now search for LP history using all related barcodes
      const allRelatedBarcodes = Array.from(relatedBarcodes);
      console.log(`Searching LP history for all related barcodes: ${allRelatedBarcodes.join(', ')}`);
      
      for (const relatedBarcode of allRelatedBarcodes) {
        if (relatedBarcode !== assetBarcode) { // Skip the original barcode as we already searched for it
          console.log(`Searching LP history for related barcode: ${relatedBarcode}`);
          
          const historyCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'assetBarcode = :assetBarcode',
            ExpressionAttributeValues: {
              ':assetBarcode': relatedBarcode
            }
          });
          
          const historyResult = await docClient.send(historyCommand);
          if (historyResult.Items && historyResult.Items.length > 0) {
            // Only add items that aren't already in the results (avoid duplicates)
            const newItems = historyResult.Items.filter(newItem => 
              !items.some(existingItem => existingItem.id === newItem.id)
            );
            items = items.concat(newItems);
            console.log(`Found ${historyResult.Items.length} LP history items for related barcode: ${relatedBarcode} (${newItems.length} new items added)`);
          } else {
            console.log(`No LP history found for related barcode: ${relatedBarcode}`);
          }
        }
      }
      
    } catch (assetError) {
      console.warn('Error searching assets for related barcodes:', assetError);
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
