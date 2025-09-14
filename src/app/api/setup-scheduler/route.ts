import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-2',
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'ScheduledReports';

// POST - Create the ScheduledReports table if it doesn't exist
export async function POST(request: NextRequest) {
  try {
    console.log('Setting up ScheduledReports table...');

    // Check if table already exists
    try {
      await docClient.send(new DescribeTableCommand({
        TableName: TABLE_NAME,
      }));
      console.log('ScheduledReports table already exists');
      return NextResponse.json({
        success: true,
        message: 'ScheduledReports table already exists',
        tableName: TABLE_NAME,
      });
    } catch (error: any) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create the table
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

    await docClient.send(createTableCommand);
    console.log('ScheduledReports table created successfully');

    return NextResponse.json({
      success: true,
      message: 'ScheduledReports table created successfully',
      tableName: TABLE_NAME,
    });
  } catch (error) {
    console.error('Error setting up ScheduledReports table:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to setup ScheduledReports table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Check if the ScheduledReports table exists
export async function GET() {
  try {
    await docClient.send(new DescribeTableCommand({
      TableName: TABLE_NAME,
    }));

    return NextResponse.json({
      success: true,
      message: 'ScheduledReports table exists',
      tableName: TABLE_NAME,
    });
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      return NextResponse.json({
        success: false,
        message: 'ScheduledReports table does not exist',
        tableName: TABLE_NAME,
      });
    }

    console.error('Error checking ScheduledReports table:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check ScheduledReports table',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
