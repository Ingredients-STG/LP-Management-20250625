import { NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

// GET /api/dashboard - Get dashboard statistics
export async function GET() {
  try {
    console.log('Fetching dashboard stats from DynamoDB...');
    
    // Ensure table exists
    await DynamoDBService.createTableIfNotExists();
    
    const stats = await DynamoDBService.getDashboardStats();
    
    console.log('Dashboard stats fetched successfully');
    
    return NextResponse.json({
      success: true,
      data: stats,
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