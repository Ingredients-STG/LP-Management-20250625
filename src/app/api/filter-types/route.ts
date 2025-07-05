import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const ddbClient = DynamoDBDocumentClient.from(client);
const FILTER_TYPES_TABLE = 'FilterTypes';

// Helper function to create filter types table if it doesn't exist
async function createFilterTypesTableIfNotExists() {
  try {
    // Check if table exists
    const describeCommand = new DescribeTableCommand({
      TableName: FILTER_TYPES_TABLE,
    });
    
    await client.send(describeCommand);
    console.log(`Filter types table ${FILTER_TYPES_TABLE} already exists`);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`Creating filter types table ${FILTER_TYPES_TABLE}...`);
      
      const createCommand = new CreateTableCommand({
        TableName: FILTER_TYPES_TABLE,
        KeySchema: [
          {
            AttributeName: 'typeId',
            KeyType: 'HASH', // Partition key
          },
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'typeId',
            AttributeType: 'S',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      });

      await client.send(createCommand);
      
      // Wait for table to be created
      await waitUntilTableExists(
        { client, maxWaitTime: 60 },
        { TableName: FILTER_TYPES_TABLE }
      );
      
      console.log(`Filter types table ${FILTER_TYPES_TABLE} created successfully`);
      
      // Seed default filter types
      await seedDefaultFilterTypes();
    } else {
      console.error('Error checking/creating filter types table:', error);
      throw error;
    }
  }
}

// Helper function to seed default filter types
async function seedDefaultFilterTypes() {
  const defaultTypes = ['Standard', 'Advanced', 'Premium', 'Basic'];
  
  for (const label of defaultTypes) {
    try {
      const typeId = `filter-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await ddbClient.send(new PutCommand({
        TableName: FILTER_TYPES_TABLE,
        Item: {
          typeId,
          label: label.trim(),
          createdAt: new Date().toISOString(),
          createdBy: 'system'
        },
      }));
    } catch (error) {
      console.error(`Error seeding filter type ${label}:`, error);
    }
  }
}

export async function GET() {
  try {
    await createFilterTypesTableIfNotExists();
    
    const result = await ddbClient.send(new ScanCommand({
      TableName: FILTER_TYPES_TABLE,
    }));

    const filterTypes = result.Items?.map(item => item.label) || [];
    return NextResponse.json({ success: true, data: filterTypes });
  } catch (error) {
    console.error('Error fetching filter types:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch filter types' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await createFilterTypesTableIfNotExists();
    
    const { label } = await req.json();

    if (!label || typeof label !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Label is required and must be a string' 
      }, { status: 400 });
    }

    const typeId = `filter-type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await ddbClient.send(new PutCommand({
      TableName: FILTER_TYPES_TABLE,
      Item: {
        typeId,
        label: label.trim(),
        createdAt: new Date().toISOString(),
        createdBy: 'Current User' // TODO: Replace with actual user from authentication
      },
      ConditionExpression: 'attribute_not_exists(#label)',
      ExpressionAttributeNames: { '#label': 'label' }
    }));

    return NextResponse.json({ 
      success: true, 
      message: 'Filter type created successfully',
      data: { typeId, label: label.trim() }
    });
  } catch (error: any) {
    console.error('Error creating filter type:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return NextResponse.json({ 
        success: false, 
        error: 'Filter type already exists' 
      }, { status: 409 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create filter type' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await createFilterTypesTableIfNotExists();
    
    console.log('DELETE filter type request received');
    const body = await req.json();
    console.log('Request body:', body);
    
    const { label } = body;

    if (!label) {
      console.log('Label is missing from request');
      return NextResponse.json({ 
        success: false, 
        error: 'Label is required' 
      }, { status: 400 });
    }

    console.log('Searching for filter type with label:', label);
    
    // First, find the item by label
    const scanResult = await ddbClient.send(new ScanCommand({
      TableName: FILTER_TYPES_TABLE,
      FilterExpression: '#label = :label',
      ExpressionAttributeNames: { '#label': 'label' },
      ExpressionAttributeValues: { ':label': label }
    }));

    console.log('Scan result:', scanResult);

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('Filter type not found');
      return NextResponse.json({ 
        success: false, 
        error: 'Filter type not found' 
      }, { status: 404 });
    }

    const item = scanResult.Items[0];
    console.log('Found item to delete:', item);
    
    // Delete the item using its primary key
    await ddbClient.send(new DeleteCommand({
      TableName: FILTER_TYPES_TABLE,
      Key: { typeId: item.typeId }
    }));

    console.log('Filter type deleted successfully');
    return NextResponse.json({ 
      success: true, 
      message: 'Filter type deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting filter type:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    return NextResponse.json({ 
      success: false, 
      error: `Failed to delete filter type: ${error?.message || 'Unknown error'}` 
    }, { status: 500 });
  }
} 