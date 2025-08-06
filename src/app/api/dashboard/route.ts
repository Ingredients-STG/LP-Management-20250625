import { NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

// GET /api/dashboard - Get dashboard statistics
export async function GET() {
  try {
    console.log('Fetching dashboard stats from DynamoDB...');
    
    // Ensure table exists
    await DynamoDBService.createTableIfNotExists();
    
    const stats = await DynamoDBService.getDashboardStats();
    
    // Fetch SPListItems data
    let spListData = null;
    try {
      const spListResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/splist-items?period=30`);
      if (spListResponse.ok) {
        const spListResult = await spListResponse.json();
        if (spListResult.success) {
          spListData = spListResult.data;
        }
      }
    } catch (spError) {
      console.warn('Failed to fetch SPListItems data:', spError);
      // Continue without SPListItems data
    }
    
    console.log('Dashboard stats fetched successfully');
    
    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        spListItems: spListData
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard stats',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 