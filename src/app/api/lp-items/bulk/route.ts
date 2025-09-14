import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  BatchWriteCommand,
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

// Ensure table exists
async function ensureTableExists() {
  try {
    const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
    
    try {
      await client.send(new (await import('@aws-sdk/client-dynamodb')).DescribeTableCommand({
        TableName: TABLE_NAME
      }));
      console.log(`Table ${TABLE_NAME} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Creating table ${TABLE_NAME}...`);
        
        await client.send(new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' }
          ],
          AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' }
          ],
          BillingMode: 'PAY_PER_REQUEST'
        }));
        
        console.log(`Table ${TABLE_NAME} created successfully`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(`Error ensuring table ${TABLE_NAME} exists:`, error);
    throw error;
  }
}

// Helper function to process items in batches of 25 (DynamoDB limit)
async function batchWriteItems(items: any[]) {
  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  const results = [];
  for (const batch of batches) {
    const writeRequests = batch.map(item => ({
      PutRequest: {
        Item: item
      }
    }));

    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: writeRequests
      }
    });

    const result = await docClient.send(command);
    results.push(result);
  }

  return results;
}

// POST - Bulk create/update LP items (for Power Automate)
export async function POST(request: NextRequest) {
  try {
    console.log('Processing bulk LP items update...');
    await ensureTableExists();

    const body = await request.json();
    const { items, source = 'power-automate' } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: 'Items array is required' },
        { status: 400 }
      );
    }

    console.log(`Processing ${items.length} LP items from ${source}...`);

    // Check for existing WO Numbers to prevent duplicates
    const existingItems = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'woNumber'
    }));
    
    const existingWONumbers = existingItems.Items?.map(item => item.woNumber) || [];
    
    // Filter out duplicates
    const uniqueItems = items.filter(item => {
      const woNumber = item['WO Number'] || item.woNumber || '';
      return !existingWONumbers.includes(woNumber);
    });
    
    const duplicateCount = items.length - uniqueItems.length;
    if (duplicateCount > 0) {
      console.log(`Found ${duplicateCount} duplicate WO Numbers, processing only ${uniqueItems.length} unique items`);
    }

    const now = new Date().toISOString();
    const processedItems = uniqueItems.map((item, index) => {
      // Generate ID if not provided
      const id = item.id || `lp-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate status based on remedialWoNumber
      const remedialWoNumber = item['Remedial WO Number'] || item.remedialWoNumber || '';
      const status = (!remedialWoNumber || remedialWoNumber === '' || remedialWoNumber === 'N/A') 
        ? 'In Progress' 
        : 'Completed';
      
      return {
        id,
        itemInternalId: item.ItemInternalId || item.itemInternalId || '',
        woNumber: item['WO Number'] || item.woNumber || '',
        createdDate: item['Created Date'] || item.createdDate || '',
        room: item.Room || item.room || '',
        location: item.Location || item.location || '',
        wing: item.Wing || item.wing || '',
        assetBarcode: item['Asset Barcode'] || item.assetBarcode || '',
        positiveCountPre: item['Positive Count (Pre)'] || item.positiveCountPre || '0',
        positiveCountPost: item['Positive Count (Post)'] || item.positiveCountPost || '0',
        sampleNumber: item['Sample Number'] || item.sampleNumber || '',
        labName: item['Lab Name'] || item.labName || '',
        certificateNumber: item['Certificate Number'] || item.certificateNumber || '',
        sampleType: item['Sample Type'] || item.sampleType || '',
        testType: item['Test Type'] || item.testType || '',
        sampleTemperature: item['Sample Temperature'] || item.sampleTemperature || '',
        bacteriaVariant: item['Bacteria Variant'] || item.bacteriaVariant || '',
        sampledOn: item['Sampled On'] || item.sampledOn || '',
        nextResampleDate: item['Next Resample Date'] || item.nextResampleDate || '',
        hotTemperature: item['Hot Temperature'] || item.hotTemperature || '',
        coldTemperature: item['Cold Temperature'] || item.coldTemperature || '',
        remedialWoNumber: remedialWoNumber,
        remedialCompletedDate: item['Remedial Completed Date'] || item.remedialCompletedDate || '',
        status: status,
        // System fields
        createdAt: item.createdAt || now,
        updatedAt: now,
        createdBy: item.createdBy || source,
        modifiedBy: source,
        // Store original SharePoint data for reference
        originalData: item,
        syncedAt: now,
        reconciliationStatus: 'synced'
      };
    });

    // Only clear existing items if explicitly requested (for Power Automate full sync)
    if (source === 'power-automate-full-sync') {
      console.log('Clearing existing LP items for full sync...');
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
        ProjectionExpression: 'id'
      });
      const existingItems = await docClient.send(scanCommand);

      if (existingItems.Items && existingItems.Items.length > 0) {
        const deleteRequests = existingItems.Items.map(item => ({
          DeleteRequest: {
            Key: { id: item.id }
          }
        }));

        // Process deletes in batches
        for (let i = 0; i < deleteRequests.length; i += 25) {
          const batch = deleteRequests.slice(i, i + 25);
          const deleteCommand = new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAME]: batch
            }
          });
          await docClient.send(deleteCommand);
        }
      }
    } else {
      console.log('Appending new LP items (preserving existing data)...');
    }

    // Insert new items
    await batchWriteItems(processedItems);

    console.log(`Successfully processed ${processedItems.length} LP items`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedItems.length} LP items${duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''}`,
      count: processedItems.length,
      duplicatesSkipped: duplicateCount,
      source,
      syncedAt: now
    });

  } catch (error) {
    console.error('Error processing bulk LP items:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process bulk LP items',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Get bulk sync status
export async function GET(request: NextRequest) {
  try {
    console.log('Getting LP items bulk sync status...');
    await ensureTableExists();

    const command = new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'id, itemName, syncedAt, reconciliationStatus'
    });

    const result = await docClient.send(command);
    const items = result.Items || [];

    const stats = {
      totalItems: items.length,
      syncedItems: items.filter(item => item.reconciliationStatus === 'synced').length,
      lastSyncTime: items.length > 0 ? 
        Math.max(...items.map(item => new Date(item.syncedAt || 0).getTime())) : null
    };

    return NextResponse.json({
      success: true,
      stats,
      lastSyncTime: stats.lastSyncTime ? new Date(stats.lastSyncTime).toISOString() : null
    });

  } catch (error) {
    console.error('Error getting bulk sync status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get bulk sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Clear all LP items (for testing purposes)
export async function DELETE(request: NextRequest) {
  try {
    console.log('Clearing all LP items...');
    await ensureTableExists();

    // Scan all items to get their IDs
    const scanCommand = new ScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'id'
    });
    const existingItems = await docClient.send(scanCommand);

    if (!existingItems.Items || existingItems.Items.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No LP items to delete',
        deletedCount: 0
      });
    }

    const deleteRequests = existingItems.Items.map(item => ({
      DeleteRequest: {
        Key: { id: item.id }
      }
    }));

    // Process deletes in batches of 25 (DynamoDB limit)
    let deletedCount = 0;
    for (let i = 0; i < deleteRequests.length; i += 25) {
      const batch = deleteRequests.slice(i, i + 25);
      const deleteCommand = new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch
        }
      });
      await docClient.send(deleteCommand);
      deletedCount += batch.length;
    }

    console.log(`Successfully deleted ${deletedCount} LP items`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} LP items`,
      deletedCount
    });

  } catch (error) {
    console.error('Error clearing LP items:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clear LP items',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
