import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json(
        { error: 'assetId query parameter is required' },
        { status: 400 }
      );
    }

    const auditEntries = await DynamoDBService.getAssetAuditEntries(assetId);

    return NextResponse.json({ 
      success: true, 
      data: auditEntries 
    });
  } catch (error) {
    console.error('Error getting audit entries:', error);
    return NextResponse.json(
      { error: 'Failed to get audit entries' },
      { status: 500 }
    );
  }
} 