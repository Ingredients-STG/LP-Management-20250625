import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

// GET /api/assets - Get all assets
export async function GET() {
  try {
    console.log('Fetching assets from DynamoDB...');
    
    // Ensure table exists
    await DynamoDBService.createTableIfNotExists();
    
    const assets = await DynamoDBService.getAllAssets();
    
    console.log(`Found ${assets.length} assets`);
    
    return NextResponse.json({
      success: true,
      data: {
        items: assets,
        count: assets.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch assets',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST /api/assets - Create new asset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Creating asset in DynamoDB:', body);
    
    // Ensure table exists
    await DynamoDBService.createTableIfNotExists();
    
    const newAsset = await DynamoDBService.createAsset({
      ...body,
      createdBy: 'Current User',
      modifiedBy: 'Current User',
    });
    
    console.log('Asset created successfully:', newAsset.id);
    
    return NextResponse.json({
      success: true,
      data: newAsset,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating asset:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create asset',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 