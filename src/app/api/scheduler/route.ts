import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BackupService } from '@/lib/backup';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-2',
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'ScheduledReports';

interface ScheduledReport {
  id: string;
  name: string;
  databases: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  recipients: string[];
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

// Calculate next run time based on frequency and last run
function calculateNextRun(frequency: string, lastRun?: string): string {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(9, 0, 0, 0); // 9 AM
      return nextDay.toISOString();
      
    case 'weekly':
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0); // 9 AM
      return nextWeek.toISOString();
      
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setHours(9, 0, 0, 0); // 9 AM
      return nextMonth.toISOString();
      
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }
}

// Check if a report should run now
function shouldRunNow(report: ScheduledReport): boolean {
  if (!report.isActive || !report.nextRun) {
    return false;
  }
  
  const now = new Date();
  const nextRun = new Date(report.nextRun);
  
  // Run if the next run time has passed (with 1 hour tolerance)
  return now >= new Date(nextRun.getTime() - 60 * 60 * 1000);
}

// POST - Execute scheduled reports (called by cron job or manual trigger)
export async function POST(request: NextRequest) {
  try {
    console.log('Starting scheduled reports execution... (v1.1)');
    
    // Get all active scheduled reports
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': true,
      },
    });

    const response = await docClient.send(command);
    const reports = response.Items as ScheduledReport[] || [];

    console.log(`Found ${reports.length} active scheduled reports`);

    const results = [];

    for (const report of reports) {
      try {
        if (shouldRunNow(report)) {
          console.log(`Executing scheduled report: ${report.name} (ID: ${report.id})`);
          
          // Send reports to all recipients
          const reportResults = [];
          for (const recipient of report.recipients) {
            try {
              const success = await BackupService.sendSelectiveBackup(
                recipient,
                report.databases,
                report.name
              );
              reportResults.push({ recipient, success });
            } catch (error) {
              console.error(`Failed to send report to ${recipient}:`, error);
              reportResults.push({ 
                recipient, 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              });
            }
          }

          // Update the report with last run time and next run time
          const now = new Date().toISOString();
          const nextRun = calculateNextRun(report.frequency, now);

          await docClient.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id: report.id },
            UpdateExpression: 'SET lastRun = :lastRun, nextRun = :nextRun, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':lastRun': now,
              ':nextRun': nextRun,
              ':updatedAt': now,
            },
          }));

          results.push({
            reportId: report.id,
            reportName: report.name,
            success: true,
            recipients: reportResults,
            lastRun: now,
            nextRun: nextRun,
          });

          console.log(`Successfully executed report: ${report.name}`);
        } else {
          console.log(`Report ${report.name} not due yet. Next run: ${report.nextRun}`);
        }
      } catch (error) {
        console.error(`Error executing report ${report.name}:`, error);
        results.push({
          reportId: report.id,
          reportName: report.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(`Scheduled reports execution completed. ${successCount}/${totalCount} reports executed successfully.`);

    return NextResponse.json({
      success: true,
      message: `Executed ${successCount}/${totalCount} scheduled reports`,
      results,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in scheduled reports execution:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to execute scheduled reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Get scheduler status and next runs
export async function GET() {
  try {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'isActive = :isActive',
      ExpressionAttributeValues: {
        ':isActive': true,
      },
    });

    const response = await docClient.send(command);
    const reports = response.Items as ScheduledReport[] || [];

    const now = new Date();
    const upcomingRuns = reports
      .filter(report => report.nextRun)
      .map(report => ({
        reportId: report.id,
        reportName: report.name,
        nextRun: report.nextRun,
        frequency: report.frequency,
        recipients: report.recipients.length,
        databases: report.databases.length,
        isOverdue: new Date(report.nextRun!) < now,
      }))
      .sort((a, b) => new Date(a.nextRun!).getTime() - new Date(b.nextRun!).getTime());

    return NextResponse.json({
      success: true,
      totalActiveReports: reports.length,
      upcomingRuns,
      nextExecution: upcomingRuns.length > 0 ? upcomingRuns[0].nextRun : null,
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}
