import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { BackupService } from '@/lib/backup';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-2',
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'ScheduledReports';

// POST - Send a test report
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
