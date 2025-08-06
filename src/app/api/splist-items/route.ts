import { NextResponse } from 'next/server';
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

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

interface SPListItem {
  id: string;
  Location: string;
  FilterInstalledDate: string;
  FilterType?: string;
  AssetBarcode?: string;
  status?: string;
  updatedAt?: string;
  modifiedBy?: string;
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
    
    // Filter items based on period
    let filteredItems: SPListItem[];
    
    if (period === 'all') {
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
        const changeDate = new Date(item.FilterInstalledDate);
        if (isNaN(changeDate.getTime())) {
          return false;
        }
        return changeDate >= cutoffDate;
      });
    }
    
    // Calculate analytics
    const periodDaysForAnalytics = period === 'all' ? 9999 : parseInt(period);
    const analytics = calculateAnalytics(filteredItems, periodDaysForAnalytics);
    
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

function calculateAnalytics(items: SPListItem[], periodDays: number) {
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
      .filter(item => item.FilterInstalledDate && !isNaN(new Date(item.FilterInstalledDate).getTime()))
      .sort((a, b) => new Date(b.FilterInstalledDate).getTime() - new Date(a.FilterInstalledDate).getTime())
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
  analytics.changesOverTime = generateTimeSeriesData(items, periodDays);
  
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

function generateTimeSeriesData(items: SPListItem[], periodDays: number): { date: string; count: number }[] {
  const endDate = new Date();
  
  if (periodDays >= 9999) {
    // For "All Time", use monthly granularity for the full date range of the data
    if (items.length === 0) return [];
    
    // Filter out items with invalid dates for time series
    const validItems = items.filter(item => {
      if (!item.FilterInstalledDate) return false;
      const date = new Date(item.FilterInstalledDate);
      return !isNaN(date.getTime());
    });
    
    if (validItems.length === 0) return [];
    
    const dates = validItems.map(item => new Date(item.FilterInstalledDate)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = new Date(dates[0].getFullYear(), dates[0].getMonth(), 1);
    
    return generateMonthlyData(validItems, startDate, endDate);
  }
  
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - periodDays);
  
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
    const dateStr = item.FilterInstalledDate.split('T')[0];
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
    const itemDate = new Date(item.FilterInstalledDate);
    // Get Monday of the item's week
    const monday = new Date(itemDate);
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
    const itemDate = new Date(item.FilterInstalledDate);
    const monthKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-01`;
    if (monthMap.hasOwnProperty(monthKey)) {
      monthMap[monthKey]++;
    }
  });
  
  return Object.entries(monthMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}