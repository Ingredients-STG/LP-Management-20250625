import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-2',
});

const TABLE_NAME = 'ScheduledReports';

// GET - Health check for ScheduledReports table
export async function GET() {
  try {
    console.log('Health check: Checking ScheduledReports table...');
    
    // Check if table exists
    try {
      const describeCommand = new DescribeTableCommand({
        TableName: TABLE_NAME,
      });
      
      const response = await client.send(describeCommand);
      console.log('Health check: Table exists, status:', response.Table?.TableStatus);
      
      return NextResponse.json({
        success: true,
        message: 'ScheduledReports table exists',
        tableName: TABLE_NAME,
        status: response.Table?.TableStatus,
        region: process.env.AWS_REGION || 'eu-west-2',
      });
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log('Health check: Table does not exist, creating it...');
        
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
          console.log('Health check: Table created successfully');
          
          return NextResponse.json({
            success: true,
            message: 'ScheduledReports table created successfully',
            tableName: TABLE_NAME,
            status: 'CREATING',
            region: process.env.AWS_REGION || 'eu-west-2',
          });
        } catch (createError) {
          console.error('Health check: Error creating table:', createError);
          return NextResponse.json(
            { 
              success: false,
              error: 'Failed to create ScheduledReports table',
              details: createError instanceof Error ? createError.message : 'Unknown error',
              region: process.env.AWS_REGION || 'eu-west-2',
            },
            { status: 500 }
          );
        }
      }
      
      console.error('Health check: Error checking table:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to check ScheduledReports table',
          details: error instanceof Error ? error.message : 'Unknown error',
          region: process.env.AWS_REGION || 'eu-west-2',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Health check: Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Unexpected error in health check',
        details: error instanceof Error ? error.message : 'Unknown error',
        region: process.env.AWS_REGION || 'eu-west-2',
      },
      { status: 500 }
    );
  }
}
