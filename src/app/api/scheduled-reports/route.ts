import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-2',
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'ScheduledReports';

// Ensure the ScheduledReports table exists
async function ensureTableExists() {
  try {
    console.log('ensureTableExists: Checking if table exists...');
    await client.send(new DescribeTableCommand({
      TableName: TABLE_NAME,
    }));
    console.log('ensureTableExists: Table exists');
    return true;
  } catch (error: any) {
    console.log('ensureTableExists: Error checking table:', error.name, error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.log('ensureTableExists: Table does not exist, creating it...');
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

        console.log('ensureTableExists: Sending create table command...');
        await client.send(createTableCommand);
        console.log('ensureTableExists: Table created successfully');
        
        // Wait a moment for the table to be ready
        console.log('ensureTableExists: Waiting for table to be ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('ensureTableExists: Table should be ready now');
        return true;
      } catch (createError) {
        console.error('ensureTableExists: Error creating table:', createError);
        console.error('Create error details:', {
          name: createError instanceof Error ? createError.name : 'Unknown',
          message: createError instanceof Error ? createError.message : 'Unknown error',
        });
        return false;
      }
    }
    console.error('ensureTableExists: Unexpected error checking table:', error);
    return false;
  }
}

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

// Calculate next run time based on frequency and start date
function calculateNextRun(frequency: string, startDate: string): string {
  const start = new Date(startDate);
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

// GET - List all scheduled reports
export async function GET() {
  try {
    console.log('GET /api/scheduled-reports: Starting request');
    console.log('AWS Region:', process.env.AWS_REGION || 'eu-west-2');
    
    // Ensure table exists before trying to scan it
    console.log('GET /api/scheduled-reports: Ensuring table exists...');
    const tableExists = await ensureTableExists();
    if (!tableExists) {
      console.error('GET /api/scheduled-reports: Table creation failed');
      return NextResponse.json(
        { error: 'Failed to create or access ScheduledReports table' },
        { status: 500 }
      );
    }

    console.log('GET /api/scheduled-reports: Table exists, scanning...');
    const command = new ScanCommand({
      TableName: TABLE_NAME,
    });

    const response = await docClient.send(command);
    const reports = response.Items || [];
    
    console.log(`GET /api/scheduled-reports: Found ${reports.length} reports`);
    return NextResponse.json(reports);
  } catch (error) {
    console.error('GET /api/scheduled-reports: Error fetching scheduled reports:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch scheduled reports',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Create a new scheduled report
export async function POST(request: NextRequest) {
  try {
    // Ensure table exists before trying to create a report
    const tableExists = await ensureTableExists();
    if (!tableExists) {
      return NextResponse.json(
        { error: 'Failed to create or access ScheduledReports table' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { name, databases, frequency, startDate, recipients } = body;

    if (!name || !databases || !frequency || !startDate || !recipients) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const reportId = uuidv4();
    const now = new Date().toISOString();
    const nextRun = calculateNextRun(frequency, startDate);

    const report: ScheduledReport = {
      id: reportId,
      name,
      databases,
      frequency,
      startDate,
      recipients,
      isActive: true,
      nextRun,
      createdAt: now,
      updatedAt: now,
    };

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: report,
    });

    await docClient.send(command);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled report' },
      { status: 500 }
    );
  }
}
