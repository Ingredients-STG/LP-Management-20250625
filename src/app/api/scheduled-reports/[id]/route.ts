import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-2',
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'ScheduledReports';

// Ensure the ScheduledReports table exists
async function ensureTableExists() {
  try {
    await client.send(new DescribeTableCommand({
      TableName: TABLE_NAME,
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log('ScheduledReports table does not exist, creating it...');
      try {
        const createTableCommand = new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [
            {
              AttributeName: 'id',
              KeyType: 'HASH', // Partition key
            },
          ],
          AttributeDefinitions: [
            {
              AttributeName: 'id',
              AttributeType: 'S', // String
            },
          ],
          BillingMode: 'PAY_PER_REQUEST', // On-demand billing
          StreamSpecification: {
            StreamEnabled: true,
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          },
          Tags: [
            {
              Key: 'Environment',
              Value: 'Production',
            },
            {
              Key: 'Application',
              Value: 'LP-Management',
            },
            {
              Key: 'Purpose',
              Value: 'ScheduledReports',
            },
          ],
        });

        await client.send(createTableCommand);
        console.log('ScheduledReports table created successfully');
        
        // Wait a moment for the table to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch (createError) {
        console.error('Error creating ScheduledReports table:', createError);
        return false;
      }
    }
    console.error('Error checking ScheduledReports table:', error);
    return false;
  }
}

// GET - Get a specific scheduled report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure table exists before trying to get the report
    const tableExists = await ensureTableExists();
    if (!tableExists) {
      return NextResponse.json(
        { error: 'Failed to create or access ScheduledReports table' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id },
    });

    const response = await docClient.send(command);
    
    if (!response.Item) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(response.Item);
  } catch (error) {
    console.error('Error fetching scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled report' },
      { status: 500 }
    );
  }
}

// PATCH - Update a scheduled report
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure table exists before trying to update the report
    const tableExists = await ensureTableExists();
    if (!tableExists) {
      return NextResponse.json(
        { error: 'Failed to create or access ScheduledReports table' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { isActive, name, databases, frequency, startDate, recipients } = body;

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (isActive !== undefined) {
      updateExpression.push('#isActive = :isActive');
      expressionAttributeNames['#isActive'] = 'isActive';
      expressionAttributeValues[':isActive'] = isActive;
    }

    if (name !== undefined) {
      updateExpression.push('#name = :name');
      expressionAttributeNames['#name'] = 'name';
      expressionAttributeValues[':name'] = name;
    }

    if (databases !== undefined) {
      updateExpression.push('#databases = :databases');
      expressionAttributeNames['#databases'] = 'databases';
      expressionAttributeValues[':databases'] = databases;
    }

    if (frequency !== undefined) {
      updateExpression.push('#frequency = :frequency');
      expressionAttributeNames['#frequency'] = 'frequency';
      expressionAttributeValues[':frequency'] = frequency;
    }

    if (startDate !== undefined) {
      updateExpression.push('#startDate = :startDate');
      expressionAttributeNames['#startDate'] = 'startDate';
      expressionAttributeValues[':startDate'] = startDate;
    }

    if (recipients !== undefined) {
      updateExpression.push('#recipients = :recipients');
      expressionAttributeNames['#recipients'] = 'recipients';
      expressionAttributeValues[':recipients'] = recipients;
    }

    // Always update the updatedAt timestamp
    updateExpression.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { id: params.id },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);

    return NextResponse.json({
      success: true,
      message: 'Scheduled report updated successfully',
    });
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled report' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a scheduled report
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure table exists before trying to delete the report
    const tableExists = await ensureTableExists();
    if (!tableExists) {
      return NextResponse.json(
        { error: 'Failed to create or access ScheduledReports table' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const command = new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id },
    });

    await docClient.send(command);

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled report' },
      { status: 500 }
    );
  }
}
