import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const lastEvaluatedKey = searchParams.get('lastEvaluatedKey');

    console.log('Audit entries API called with:', { assetId, limit, lastEvaluatedKey });

    let result;
    
    if (assetId) {
      // Get audit entries for specific asset with pagination
      console.log('Fetching paginated audit entries for asset:', assetId);
      result = await DynamoDBService.getAssetAuditEntriesPaginated(
        assetId, 
        limit, 
        lastEvaluatedKey ? JSON.parse(decodeURIComponent(lastEvaluatedKey)) : undefined
      );
      console.log('Found audit entries for asset:', result.entries.length, 'hasMore:', result.hasMore);
    } else {
      // Get all audit entries with pagination (global audit log)
      console.log('Fetching paginated all audit entries');
      result = await DynamoDBService.getAllAuditEntriesPaginated(
        limit, 
        lastEvaluatedKey ? JSON.parse(decodeURIComponent(lastEvaluatedKey)) : undefined
      );
      console.log('Found total audit entries:', result.entries.length, 'hasMore:', result.hasMore);
    }

    return NextResponse.json({ 
      success: true, 
      data: result.entries,
      pagination: {
        hasMore: result.hasMore,
        lastEvaluatedKey: result.lastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.lastEvaluatedKey)) : null,
        count: result.entries.length,
        limit
      }
    });
  } catch (error) {
    console.error('Error getting audit entries:', error);
    return NextResponse.json(
      { error: 'Failed to get audit entries' },
      { status: 500 }
    );
  }
} 