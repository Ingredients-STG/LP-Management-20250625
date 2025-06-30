import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assetId, user, action, details } = body;

    if (!assetId || !user || !action) {
      return NextResponse.json(
        { error: 'assetId, user, and action are required' },
        { status: 400 }
      );
    }

    const auditEntry = {
      assetId,
      timestamp: new Date().toISOString(),
      user,
      action,
      details: details || {}
    };

    await DynamoDBService.logAssetAuditEntry(auditEntry);

    return NextResponse.json({ 
      success: true, 
      message: 'Audit entry logged successfully' 
    });
  } catch (error) {
    console.error('Error logging audit entry:', error);
    return NextResponse.json(
      { error: 'Failed to log audit entry' },
      { status: 500 }
    );
  }
} 