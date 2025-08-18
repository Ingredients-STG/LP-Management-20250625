import { NextResponse } from 'next/server';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Configure AWS SDK v3
const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);
const SPLIST_TABLE_NAME = 'SPListItems';

interface SPListItem {
  id: string;
  Location: string;
  FilterInstalledDate: string;
  FilterType?: string;
  AssetBarcode?: string;
  ReasonForFilterChange?: 'Expired' | 'Remedial' | 'Blocked' | 'New Installation';
  status?: string;
  updatedAt?: string;
  modifiedBy?: string;
  reconciliationStatus?: 'pending' | 'synced' | 'failed';
  reconciliationTimestamp?: string;
  reconciledBy?: string;
}

// Helper function to create table if it doesn't exist
async function createTableIfNotExists(): Promise<void> {
  try {
    // Check if table exists
    try {
      const command = new DescribeTableCommand({ TableName: SPLIST_TABLE_NAME });
      await client.send(command);
      return;
    } catch (error: any) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create table
    const createCommand = new CreateTableCommand({
      TableName: SPLIST_TABLE_NAME,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });

    await client.send(createCommand);
  } catch (error) {
    console.error('Error creating table:', error);
  }
}

// GET /api/splist-items/[assetBarcode] - Get filter changes for specific asset barcode
export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetBarcode: string }> }
) {
  try {
    const { assetBarcode } = await params;
    console.log(`Fetching filter changes for asset barcode: ${assetBarcode}`);
    
    // Ensure table exists
    await createTableIfNotExists();
    
    // Get filter changes for the specific asset barcode
    const filterChanges: SPListItem[] = [];
    let lastEvaluatedKey: any = undefined;
    
    do {
      const command = new ScanCommand({
        TableName: SPLIST_TABLE_NAME,
        FilterExpression: 'AssetBarcode = :assetBarcode',
        ExpressionAttributeValues: {
          ':assetBarcode': assetBarcode
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100
      });
      
      const result = await dynamodb.send(command);
      
      if (result.Items && result.Items.length > 0) {
        filterChanges.push(...(result.Items as SPListItem[]));
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    // Helper function to parse dates in DD/MM/YYYY format
    const parseDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      
      // Handle DD/MM/YYYY format
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
      
      // Handle YYYY-MM-DD format
      const parsedDate = new Date(dateStr);
      return isNaN(parsedDate.getTime()) ? null : parsedDate;
    };

    // Sort by FilterInstalledDate (most recent first)
    const sortedChanges = filterChanges
      .filter(item => item.FilterInstalledDate && parseDate(item.FilterInstalledDate) !== null)
      .sort((a, b) => {
        const dateA = parseDate(a.FilterInstalledDate);
        const dateB = parseDate(b.FilterInstalledDate);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });
    
    console.log(`Found ${sortedChanges.length} filter changes for asset barcode: ${assetBarcode}`);
    
    // Debug: Log all items found for this asset barcode
    if (filterChanges.length > 0) {
      console.log('All SPListItems found for asset barcode:', assetBarcode);
      filterChanges.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
          id: item.id,
          AssetBarcode: item.AssetBarcode,
          FilterInstalledDate: item.FilterInstalledDate,
          FilterType: item.FilterType,
          ReasonForFilterChange: item.ReasonForFilterChange,
          reconciliationStatus: item.reconciliationStatus,
          updatedAt: item.updatedAt
        });
      });
    } else {
      console.log(`DEBUG: No SPListItems found with AssetBarcode = "${assetBarcode}"`);
    }
    
    return NextResponse.json({
      success: true,
      data: sortedChanges,
      count: sortedChanges.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching filter changes for asset:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch filter changes',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST /api/splist-items/[assetBarcode] - Create new filter change entry
export async function POST(
  request: Request,
  { params }: { params: Promise<{ assetBarcode: string }> }
) {
  try {
    const { assetBarcode } = await params;
    const body = await request.json();
    
    console.log(`Creating filter change entry for asset barcode: ${assetBarcode}`);
    console.log('Filter change data:', body);
    
    // Ensure table exists
    await createTableIfNotExists();
    
    const newEntry: SPListItem = {
      id: `splist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      AssetBarcode: assetBarcode,
      Location: body.location || '',
      FilterInstalledDate: body.filterInstalledDate || new Date().toISOString(),
      FilterType: body.filterType || '',
      ReasonForFilterChange: body.reasonForFilterChange || 'New Installation',
      status: 'active',
      updatedAt: new Date().toISOString(),
      modifiedBy: body.modifiedBy || 'system',
      reconciliationStatus: 'pending',
      reconciliationTimestamp: new Date().toISOString(),
      reconciledBy: null
    };
    
    const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const putCommand = new PutCommand({
      TableName: SPLIST_TABLE_NAME,
      Item: newEntry
    });
    
    await dynamodb.send(putCommand);
    
    console.log(`Successfully created filter change entry for asset: ${assetBarcode}`);
    
    return NextResponse.json({
      success: true,
      message: 'Filter change entry created successfully',
      data: newEntry
    });
    
  } catch (error) {
    console.error('Error creating filter change entry:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create filter change entry',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
