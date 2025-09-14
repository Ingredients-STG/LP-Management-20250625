import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { BackupService } from '@/lib/backup';

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

// POST - Send a test report
export async function POST(
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
    // Get the scheduled report
    const getCommand = new GetCommand({
      TableName: TABLE_NAME,
      Key: { id },
    });

    const response = await docClient.send(getCommand);
    
    if (!response.Item) {
      return NextResponse.json(
        { error: 'Scheduled report not found' },
        { status: 404 }
      );
    }

    const report = response.Item;

    // Send test report to all recipients
    const results = [];
    for (const recipient of report.recipients) {
      try {
        const success = await BackupService.sendSelectiveBackup(
          recipient,
          report.databases,
          `Test Report: ${report.name}`
        );
        results.push({ recipient, success });
      } catch (error) {
        console.error(`Failed to send test report to ${recipient}:`, error);
        results.push({ recipient, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount > 0,
      message: `Test report sent to ${successCount}/${totalCount} recipients`,
      results,
    });
  } catch (error) {
    console.error('Error sending test report:', error);
    return NextResponse.json(
      { error: 'Failed to send test report' },
      { status: 500 }
    );
  }
}
