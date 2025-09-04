import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand,
  PutCommand,
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

// GET - Fetch specific LP item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Fetching LP item: ${id}`);

    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id }
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return NextResponse.json(
        { success: false, error: 'LP item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: result.Item
    });

  } catch (error) {
    console.error('Error fetching LP item:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch LP item',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT - Update LP item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Updating LP item: ${id}`);

    const body = await request.json();

    // Validate required fields for LP items
    if (!body.assetBarcode || !body.woNumber) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: assetBarcode, woNumber' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Use PutCommand instead of UpdateCommand for simpler full item replacement
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...body,
        id,
        updatedAt: now,
        modifiedBy: body.modifiedBy || 'system'
      }
    });

    await docClient.send(command);

    console.log(`LP item updated: ${id}`);

    return NextResponse.json({
      success: true,
      item: {
        ...body,
        id,
        updatedAt: now,
        modifiedBy: body.modifiedBy || 'system'
      },
      message: 'LP item updated successfully'
    });

  } catch (error) {
    console.error('Error updating LP item:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update LP item',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete LP item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`Deleting LP item: ${id}`);

    // First check if item exists
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id }
    });

    const getResult = await docClient.send(getCommand);

    if (!getResult.Item) {
      return NextResponse.json(
        { success: false, error: 'LP item not found' },
        { status: 404 }
      );
    }

    // Delete the item
    const deleteCommand = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id }
    });

    await docClient.send(deleteCommand);

    console.log(`LP item deleted: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'LP item deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting LP item:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete LP item',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
