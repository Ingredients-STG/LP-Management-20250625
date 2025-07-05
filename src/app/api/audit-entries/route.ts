import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    let auditEntries;
    
    if (assetId) {
      // Get audit entries for specific asset
      auditEntries = await DynamoDBService.getAssetAuditEntries(assetId);
    } else {
      // Get all audit entries (global audit log)
      auditEntries = await DynamoDBService.getAllAuditEntries();
    }

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