import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

// GET - Fetch all asset types
export async function GET() {
  try {
    const assetTypes = await DynamoDBService.getAllAssetTypes();
    
    return NextResponse.json({
      success: true,
      data: assetTypes
    });
  } catch (error) {
    console.error('Error fetching asset types:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch asset types' 
      },
      { status: 500 }
    );
  }
}

// POST - Create new asset type
export async function POST(request: NextRequest) {
  try {
    const { label, createdBy } = await request.json();
    
    if (!label || typeof label !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Label is required and must be a string' },
        { status: 400 }
      );
    }

    const newAssetType = await DynamoDBService.createAssetType(label, createdBy || 'user');
    
    return NextResponse.json({
      success: true,
      data: newAssetType
    });
  } catch (error) {
    console.error('Error creating asset type:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create asset type' 
      },
      { status: 500 }
    );
  }
}

// PUT - Update asset type
export async function PUT(request: NextRequest) {
  try {
    const { typeId, label } = await request.json();
    
    if (!typeId || !label) {
      return NextResponse.json(
        { success: false, error: 'Type ID and label are required' },
        { status: 400 }
      );
    }

    const updatedAssetType = await DynamoDBService.updateAssetType(typeId, label);
    
    return NextResponse.json({
      success: true,
      data: updatedAssetType
    });
  } catch (error) {
    console.error('Error updating asset type:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update asset type' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete asset type
export async function DELETE(request: NextRequest) {
  try {
    const { label } = await request.json();
    
    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label is required' },
        { status: 400 }
      );
    }

    // Find the asset type by label to get its typeId
    const assetTypes = await DynamoDBService.getAllAssetTypes();
    const assetType = assetTypes.find(type => type.label === label);
    
    if (!assetType) {
      return NextResponse.json(
        { success: false, error: 'Asset type not found' },
        { status: 404 }
      );
    }

    await DynamoDBService.deleteAssetType(assetType.typeId);
    
    return NextResponse.json({
      success: true,
      message: 'Asset type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting asset type:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete asset type' 
      },
      { status: 500 }
    );
  }
} 