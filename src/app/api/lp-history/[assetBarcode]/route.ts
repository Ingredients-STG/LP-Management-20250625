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

    // Scan for items with matching asset barcode
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'assetBarcode = :assetBarcode',
      ExpressionAttributeValues: {
        ':assetBarcode': assetBarcode
      }
    });

    const result = await docClient.send(command);
    const items = result.Items || [];

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
