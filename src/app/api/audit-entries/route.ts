import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    console.log('Audit entries API called with assetId:', assetId);

    let auditEntries;
    
    if (assetId) {
      // Get audit entries for specific asset
      console.log('Fetching audit entries for asset:', assetId);
      auditEntries = await DynamoDBService.getAssetAuditEntries(assetId);
      console.log('Found audit entries for asset:', auditEntries.length);
      console.log('Audit entries:', auditEntries);
    } else {
      // Get all audit entries (global audit log)
      console.log('Fetching all audit entries');
      auditEntries = await DynamoDBService.getAllAuditEntries();
      console.log('Found total audit entries:', auditEntries.length);
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