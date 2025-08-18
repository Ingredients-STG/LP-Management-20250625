import { NextResponse } from 'next/server';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Configure AWS SDK v3
const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);
const SPLIST_TABLE_NAME = 'SPListItems';

// Helper function to parse DD/MM/YYYY and YYYY-MM-DD dates
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    // Use UTC to avoid timezone issues
    const parsedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }
  const parsedDate = new Date(dateStr);
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
}

interface SPListItem {
  id: string;
  Location: string;
  FilterInstalledDate: string;
  FilterType?: string;
  AssetBarcode?: string;
  ReasonForFilterChange?: 'Expired' | 'Remedial' | 'Blocked' | 'Missing' | 'New Installation';
  status?: string;
  updatedAt?: string;
  modifiedBy?: string;
  reconciliationStatus?: 'pending' | 'synced' | 'failed';
  reconciliationTimestamp?: string;
  reconciledBy?: string;
}

// Helper function to create table if it doesn't exist
async function createTableIfNotExists(): Promise<void> {
  try {
    // Check if table exists
    try {
      const command = new DescribeTableCommand({ TableName: SPLIST_TABLE_NAME });
      await client.send(command);
      console.log(`Table ${SPLIST_TABLE_NAME} already exists`);
      return;
    } catch (error: any) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create table
    const createCommand = new CreateTableCommand({
      TableName: SPLIST_TABLE_NAME,
      KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });

    console.log(`Creating table ${SPLIST_TABLE_NAME}...`);
    await client.send(createCommand);
    console.log(`Table ${SPLIST_TABLE_NAME} created successfully`);
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

// GET /api/splist-items - Get all SPListItems with analytics
export async function GET(request: Request) {
  try {
    console.log('Fetching SPListItems from DynamoDB...');
    
    // Ensure table exists
    await createTableIfNotExists();
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30'; // Default to 30 days
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const latest = searchParams.get('latest'); // Check if we want latest record
    
    // Get all SPListItems
    const allItems: SPListItem[] = [];
    let lastEvaluatedKey: any = undefined;
    
    do {
      const command = new ScanCommand({
        TableName: SPLIST_TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100
      });
      
      const result = await dynamodb.send(command);
      
      if (result.Items && result.Items.length > 0) {
        allItems.push(...(result.Items as SPListItem[]));
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`Found ${allItems.length} SPListItems`);
    
    // If requesting latest record only, return the most recent one
    if (latest === 'true') {
      // Sort by updatedAt or id (which contains timestamp) to get the latest
      const sortedItems = allItems
        .filter(item => item.updatedAt || item.id) // Ensure we have a timestamp
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.id).getTime();
          const bTime = new Date(b.updatedAt || b.id).getTime();
          return bTime - aTime; // Descending order (latest first)
        });
      
      if (sortedItems.length > 0) {
        console.log('Latest SPListItem found:', sortedItems[0].id);
        console.log('Latest 5 SPListItems:', sortedItems.slice(0, 5).map(item => ({
          id: item.id,
          AssetBarcode: item.AssetBarcode,
          ReasonForFilterChange: item.ReasonForFilterChange,
          updatedAt: item.updatedAt
        })));
        
        return NextResponse.json({
          success: true,
          data: sortedItems[0],
          latest5: sortedItems.slice(0, 5), // Include latest 5 for debugging
          message: 'Latest SPListItem record',
          timestamp: new Date().toISOString()
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'No SPListItems found',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Filter items based on period or date range
    let filteredItems: SPListItem[];
    
    if (startDate && endDate) {
      // Filter by custom date range
      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T23:59:59.999Z');

      filteredItems = allItems.filter(item => {
        if (!item.FilterInstalledDate) {
          return false;
        }
        const changeDate = parseDate(item.FilterInstalledDate);
        if (!changeDate) {
          return false;
        }
        return changeDate >= start && changeDate <= end;
      });
    } else if (period === 'all') {
      // Show all items regardless of date (include items with missing/invalid dates)
      filteredItems = allItems;
    } else {
      // Filter by time period
      const periodDays = parseInt(period);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - periodDays);
      
      filteredItems = allItems.filter(item => {
        if (!item.FilterInstalledDate) {
          return false;
        }
        const changeDate = parseDate(item.FilterInstalledDate);
        if (!changeDate) {
          return false;
        }
        return changeDate >= cutoffDate;
      });
    }
    
    // Calculate analytics
    let periodDaysForAnalytics: number;
    if (period === 'all') {
      periodDaysForAnalytics = 9999;
    } else if (startDate && endDate) {
      // For custom date ranges, calculate the actual period
      const start = new Date(startDate);
      const end = new Date(endDate);
      periodDaysForAnalytics = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      periodDaysForAnalytics = parseInt(period);
    }
    const analytics = calculateAnalytics(filteredItems, periodDaysForAnalytics, startDate, endDate);
    
    return NextResponse.json({
      success: true,
      data: {
        items: filteredItems,
        analytics,
        period: period === 'all' ? 'All Time' : periodDaysForAnalytics,
        totalCount: allItems.length,
        filteredCount: filteredItems.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching SPListItems:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch SPListItems',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

function calculateAnalytics(items: SPListItem[], periodDays: number, customStartDate?: string, customEndDate?: string) {
  const now = new Date();
  const analytics = {
    totalChanges: items.length,
    locationBreakdown: {} as { [key: string]: number },
    wingBreakdown: {} as { [key: string]: number },
    filterTypeBreakdown: {} as { [key: string]: number },
    changesOverTime: [] as { date: string; count: number }[],
    topLocations: [] as { location: string; count: number }[],
    topWings: [] as { wing: string; count: number }[],
    recentChanges: items
      .filter(item => item.FilterInstalledDate && parseDate(item.FilterInstalledDate) !== null)
      .sort((a, b) => {
        const dateA = parseDate(a.FilterInstalledDate);
        const dateB = parseDate(b.FilterInstalledDate);
        return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
      })
      .slice(0, 10)
  };
  
  // Location breakdown by wing (extract wing from location like "LNS-1.095" -> "LNS")
  const wingBreakdown: { [key: string]: number } = {};
  items.forEach(item => {
    const wing = item.Location.split('-')[0] || item.Location; // Get part before "-" or full location if no "-"
    wingBreakdown[wing] = (wingBreakdown[wing] || 0) + 1;
    // Also keep the original location breakdown for detailed analysis
    analytics.locationBreakdown[item.Location] = (analytics.locationBreakdown[item.Location] || 0) + 1;
  });
  
  // Add wing breakdown to analytics
  analytics.wingBreakdown = wingBreakdown;
  
  // Filter type breakdown
  items.forEach(item => {
    if (item.FilterType && item.FilterType !== 'Not set') {
      analytics.filterTypeBreakdown[item.FilterType] = (analytics.filterTypeBreakdown[item.FilterType] || 0) + 1;
    }
  });
  
  // Changes over time with appropriate granularity based on period
  analytics.changesOverTime = generateTimeSeriesData(items, periodDays, customStartDate, customEndDate);
  
  // Top locations
  analytics.topLocations = Object.entries(analytics.locationBreakdown)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
    
  // Top wings
  analytics.topWings = Object.entries(analytics.wingBreakdown)
    .map(([wing, count]) => ({ wing, count }))
    .sort((a, b) => b.count - a.count);
  
  return analytics;
}

function generateTimeSeriesData(items: SPListItem[], periodDays: number, customStartDate?: string, customEndDate?: string): { date: string; count: number }[] {
  const endDate = customEndDate ? new Date(customEndDate) : new Date();
  
  if (periodDays >= 9999) {
    // For "All Time", use monthly granularity for the full date range of the data
    if (items.length === 0) return [];
    
    // Filter out items with invalid dates for time series
    const validItems = items.filter(item => {
      if (!item.FilterInstalledDate) return false;
      return parseDate(item.FilterInstalledDate) !== null;
    });
    
    if (validItems.length === 0) return [];
    
    const dates = validItems
      .map(item => parseDate(item.FilterInstalledDate))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const startDate = new Date(dates[0].getFullYear(), dates[0].getMonth(), 1);
    
    return generateMonthlyData(validItems, startDate, endDate);
  }
  
  const startDate = customStartDate ? new Date(customStartDate) : (() => {
    const calculated = new Date();
    calculated.setDate(endDate.getDate() - periodDays);
    return calculated;
  })();
  
  if (periodDays <= 7) {
    // Daily granularity for 7 days or less
    return generateDailyData(items, startDate, endDate);
  } else if (periodDays <= 30) {
    // Daily granularity for 30 days
    return generateDailyData(items, startDate, endDate);
  } else if (periodDays <= 90) {
    // Weekly granularity for 90 days
    return generateWeeklyData(items, startDate, endDate);
  } else {
    // Monthly granularity for 365 days
    return generateMonthlyData(items, startDate, endDate);
  }
}

function generateDailyData(items: SPListItem[], startDate: Date, endDate: Date): { date: string; count: number }[] {
  const dateMap: { [key: string]: number } = {};
  
  // Initialize all dates in range with 0
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dateMap[dateStr] = 0;
  }
  
  // Count actual changes
  items.forEach(item => {
    if (!item.FilterInstalledDate) return;
    
    const parsedDate = parseDate(item.FilterInstalledDate);
    if (!parsedDate) return;
    
    const dateStr = parsedDate.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
    if (dateMap.hasOwnProperty(dateStr)) {
      dateMap[dateStr]++;
    }
  });
  
  return Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function generateWeeklyData(items: SPListItem[], startDate: Date, endDate: Date): { date: string; count: number }[] {
  const weekMap: { [key: string]: number } = {};
  
  // Initialize weeks in range with 0
  const current = new Date(startDate);
  while (current <= endDate) {
    // Get Monday of the current week
    const monday = new Date(current);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    
    const weekKey = monday.toISOString().split('T')[0];
    weekMap[weekKey] = 0;
    
    current.setDate(current.getDate() + 7);
  }
  
  // Count actual changes by week
  items.forEach(item => {
    if (!item.FilterInstalledDate) return;
    
    const parsedDate = parseDate(item.FilterInstalledDate);
    if (!parsedDate) return;
    
    // Get Monday of the item's week
    const monday = new Date(parsedDate);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    
    const weekKey = monday.toISOString().split('T')[0];
    if (weekMap.hasOwnProperty(weekKey)) {
      weekMap[weekKey]++;
    }
  });
  
  return Object.entries(weekMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function generateMonthlyData(items: SPListItem[], startDate: Date, endDate: Date): { date: string; count: number }[] {
  const monthMap: { [key: string]: number } = {};
  
  // Initialize months in range with 0
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  
  while (current <= end) {
    const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`;
    monthMap[monthKey] = 0;
    current.setMonth(current.getMonth() + 1);
  }
  
  // Count actual changes by month
  items.forEach(item => {
    if (!item.FilterInstalledDate) return;
    
    const parsedDate = parseDate(item.FilterInstalledDate);
    if (!parsedDate) return;
    
    const monthKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-01`;
    if (monthMap.hasOwnProperty(monthKey)) {
      monthMap[monthKey]++;
    }
  });
  
  return Object.entries(monthMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// PUT /api/splist-items - Update reconciliation status
export async function PUT(request: Request) {
  try {
    console.log('Updating SPListItem reconciliation status...');
    
    const body = await request.json();
    const { id, reconciliationStatus, reconciledBy } = body;
    
    if (!id || !reconciliationStatus) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: id, reconciliationStatus',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }
    
    // Ensure table exists
    await createTableIfNotExists();
    
    const now = new Date().toISOString();
    
    const updateCommand = new UpdateCommand({
      TableName: SPLIST_TABLE_NAME,
      Key: { id },
      UpdateExpression: 'SET reconciliationStatus = :status, reconciliationTimestamp = :timestamp, reconciledBy = :reconciledBy, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':status': reconciliationStatus,
        ':timestamp': now,
        ':reconciledBy': reconciledBy || 'System',
        ':updatedAt': now
      },
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await dynamodb.send(updateCommand);
    
    console.log('SPListItem reconciliation status updated successfully');
    
    return NextResponse.json({
      success: true,
      data: result.Attributes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating SPListItem reconciliation status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update SPListItem reconciliation status',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// DELETE /api/splist-items - Delete SPListItem
export async function DELETE(request: Request) {
  try {
    console.log('Deleting SPListItem...');
    
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: id',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }
    
    // Ensure table exists
    await createTableIfNotExists();
    
    const deleteCommand = new DeleteCommand({
      TableName: SPLIST_TABLE_NAME,
      Key: { id },
      ReturnValues: 'ALL_OLD'
    });
    
    const result = await dynamodb.send(deleteCommand);
    
    if (!result.Attributes) {
      return NextResponse.json(
        {
          success: false,
          error: 'SPListItem not found',
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }
    
    console.log('SPListItem deleted successfully:', id);
    
    return NextResponse.json({
      success: true,
      data: result.Attributes,
      message: 'SPListItem deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting SPListItem:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete SPListItem',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}