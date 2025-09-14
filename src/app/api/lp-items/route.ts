import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand
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
    // Try to describe table first to see if it exists
    const { CreateTableCommand } = await import('@aws-sdk/client-dynamodb');
    
    try {
      await client.send(new (await import('@aws-sdk/client-dynamodb')).DescribeTableCommand({
        TableName: TABLE_NAME
      }));
      console.log(`Table ${TABLE_NAME} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Table doesn't exist, create it
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

// GET - Fetch all LP items
export async function GET(request: NextRequest) {
  try {
    console.log('Fetching LP items from DynamoDB...');
    await ensureTableExists();

    const command = new ScanCommand({
      TableName: TABLE_NAME
    });

    const result = await docClient.send(command);
    
    console.log(`Found ${result.Items?.length || 0} LP items`);

    return NextResponse.json({
      success: true,
      items: result.Items || [],
      count: result.Items?.length || 0
    });

  } catch (error) {
    console.error('Error fetching LP items:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch LP items',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Create new LP item
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new LP item...');
    await ensureTableExists();

    const body = await request.json();
    const { woNumber, assetBarcode, room, wardDept, location, positiveCountPre, positiveCountPost, sampleType, modifiedBy } = body;

    if (!woNumber || !assetBarcode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: woNumber, assetBarcode' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = `lp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate status based on remedialWoNumber
    const status = (!body.remedialWoNumber || body.remedialWoNumber === '' || body.remedialWoNumber === 'N/A') 
      ? 'In Progress' 
      : 'Completed';

    const item = {
      id,
      itemInternalId: body.itemInternalId || `int-${Date.now()}`,
      woNumber,
      createdDate: body.createdDate || now,
      room: room || '',
      wardDept: wardDept || '',
      location: location || '',
      assetBarcode,
      positiveCountPre: positiveCountPre || '0',
      positiveCountPost: positiveCountPost || '0',
      sampleNumber: body.sampleNumber || '',
      labName: body.labName || '',
      certificateNumber: body.certificateNumber || '',
      sampleType: sampleType || '',
      testType: body.testType || '',
      sampleTemperature: body.sampleTemperature || '',
      bacteriaVariant: body.bacteriaVariant || '',
      sampledOn: body.sampledOn || '',
      nextResampleDate: body.nextResampleDate || '',
      hotTemperature: body.hotTemperature || '',
      coldTemperature: body.coldTemperature || '',
      remedialWoNumber: body.remedialWoNumber || '',
      remedialCompletedDate: body.remedialCompletedDate || '',
      status: status,
      createdAt: now,
      updatedAt: now,
      createdBy: modifiedBy || 'system',
      modifiedBy: modifiedBy || 'system'
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    });

    await docClient.send(command);

    console.log(`LP item created with ID: ${id}`);

    return NextResponse.json({
      success: true,
      item,
      message: 'LP item created successfully'
    });

  } catch (error) {
    console.error('Error creating LP item:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create LP item',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
