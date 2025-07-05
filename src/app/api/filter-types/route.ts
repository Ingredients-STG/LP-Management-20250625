import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const ddbClient = DynamoDBDocumentClient.from(client);
const FILTER_TYPES_TABLE = 'FilterTypes';

export async function GET() {
  try {
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
    const { label } = await req.json();

    if (!label) {
      return NextResponse.json({ 
        success: false, 
        error: 'Label is required' 
      }, { status: 400 });
    }

    // First, find the item by label
    const scanResult = await ddbClient.send(new ScanCommand({
      TableName: FILTER_TYPES_TABLE,
      FilterExpression: '#label = :label',
      ExpressionAttributeNames: { '#label': 'label' },
      ExpressionAttributeValues: { ':label': label }
    }));

    if (!scanResult.Items || scanResult.Items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Filter type not found' 
      }, { status: 404 });
    }

    const item = scanResult.Items[0];
    
    // Delete the item using its primary key
    await ddbClient.send(new DeleteCommand({
      TableName: FILTER_TYPES_TABLE,
      Key: { typeId: item.typeId }
    }));

    return NextResponse.json({ 
      success: true, 
      message: 'Filter type deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting filter type:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete filter type' 
    }, { status: 500 });
  }
} 