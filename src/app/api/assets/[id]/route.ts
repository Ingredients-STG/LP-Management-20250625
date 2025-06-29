import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

// GET /api/assets/[id] - Get asset by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log('Fetching asset by ID:', id);
    
    const asset = await DynamoDBService.getAssetById(id);
    
    if (!asset) {
      return NextResponse.json(
        {
          success: false,
          error: 'Asset not found',
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: asset,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching asset:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch asset',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// PUT /api/assets/[id] - Update asset
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    console.log('Updating asset in DynamoDB:', id, body);
    
    const updatedAsset = await DynamoDBService.updateAsset(id, {
      ...body,
      modifiedBy: 'Current User',
    });
    
    console.log('Asset updated successfully:', id);
    
    return NextResponse.json({
      success: true,
      data: updatedAsset,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update asset',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// DELETE /api/assets/[id] - Delete asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log('Deleting asset from DynamoDB:', id);
    
    await DynamoDBService.deleteAsset(id);
    
    console.log('Asset deleted successfully:', id);
    
    return NextResponse.json({
      success: true,
      message: 'Asset deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete asset',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 