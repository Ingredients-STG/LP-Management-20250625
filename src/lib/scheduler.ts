import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BackupService } from './backup';

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

export class SchedulerService {
  /**
   * Calculate next run time based on frequency and last run
   */
  private static calculateNextRun(frequency: string, lastRun?: string): string {
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

  /**
   * Check if a report should run now
   */
  private static shouldRunNow(report: ScheduledReport): boolean {
    if (!report.isActive || !report.nextRun) {
      return false;
    }
    
    const now = new Date();
    const nextRun = new Date(report.nextRun);
    
    // Run if the next run time has passed (with 1 hour tolerance)
    return now >= new Date(nextRun.getTime() - 60 * 60 * 1000);
  }

  /**
   * Execute all due scheduled reports
   */
  public static async executeScheduledReports(): Promise<{
    success: boolean;
    executed: number;
    total: number;
    results: any[];
  }> {
    try {
      console.log('Starting scheduled reports execution...');
      
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
      let executedCount = 0;

      for (const report of reports) {
        try {
          if (this.shouldRunNow(report)) {
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
            const nextRun = this.calculateNextRun(report.frequency, now);

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

            executedCount++;
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

      console.log(`Scheduled reports execution completed. ${executedCount}/${reports.length} reports executed.`);

      return {
        success: true,
        executed: executedCount,
        total: reports.length,
        results,
      };
    } catch (error) {
      console.error('Error in scheduled reports execution:', error);
      return {
        success: false,
        executed: 0,
        total: 0,
        results: [],
      };
    }
  }

  /**
   * Get scheduler status and upcoming runs
   */
  public static async getSchedulerStatus(): Promise<{
    success: boolean;
    totalActiveReports: number;
    upcomingRuns: any[];
    nextExecution: string | null;
  }> {
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

      return {
        success: true,
        totalActiveReports: reports.length,
        upcomingRuns,
        nextExecution: upcomingRuns.length > 0 ? upcomingRuns[0].nextRun : null,
      };
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      return {
        success: false,
        totalActiveReports: 0,
        upcomingRuns: [],
        nextExecution: null,
      };
    }
  }
}
