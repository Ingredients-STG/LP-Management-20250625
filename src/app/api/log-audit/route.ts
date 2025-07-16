import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assetId, user, action, details } = body;

    console.log('Log-audit API called with:', { assetId, user, action, detailsCount: details?.changes?.length || 0 });

    if (!assetId || !user || !action) {
      console.error('Missing required fields:', { assetId, user, action });
      return NextResponse.json(
        { error: 'assetId, user, and action are required' },
        { status: 400 }
      );
    }

    const auditEntry = {
      assetId,
      timestamp: new Date().toISOString(), // Clean ISO timestamp
      user,
      action,
      details: details || {}
    };

    console.log('Creating audit entry:', auditEntry);

    await DynamoDBService.logAssetAuditEntry(auditEntry);

    console.log('Audit entry created successfully');

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