import { NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET() {
  try {
    console.log('GET /api/reports/flushing-list: Starting request');
    
    // Get all assets from the database
    const allAssets = await DynamoDBService.getAllAssets();
    console.log(`Found ${allAssets.length} total assets in database`);

    // Flushing List - Assets that need flushing OR are low usage
    // Logic: (needFlushing = true OR lowUsageAsset = true) AND (status = ACTIVE OR status = MAINTENANCE)
    const flushingAssets = allAssets.filter(asset => {
      const needsFlushing = asset.needFlushing === true || 
                           asset.needFlushing === 'true' || 
                           asset.needFlushing === 'True' || 
                           asset.needFlushing === 'YES' || 
                           asset.needFlushing === 'Yes';
      
      const isLowUsage = asset.lowUsageAsset === true || 
                        asset.lowUsageAsset === 'true' || 
                        asset.lowUsageAsset === 'True' || 
                        asset.lowUsageAsset === 'YES' || 
                        asset.lowUsageAsset === 'Yes';
      
      const isActiveOrMaintenance = asset.status === 'ACTIVE' || asset.status === 'MAINTENANCE';
      
      return (needsFlushing || isLowUsage) && isActiveOrMaintenance;
    }).sort((a, b) => {
      // Sort by Wing first, then by Room
      const wingA = (a.wing || '').toString().toLowerCase();
      const wingB = (b.wing || '').toString().toLowerCase();
      const wingComparison = wingA.localeCompare(wingB);
      
      if (wingComparison !== 0) {
        return wingComparison;
      }
      
      // If wings are the same, sort by Room
      const roomA = (a.room || '').toString().toLowerCase();
      const roomB = (b.room || '').toString().toLowerCase();
      return roomA.localeCompare(roomB);
    });

    console.log(`Found ${flushingAssets.length} assets for flushing list`);

    return NextResponse.json({
      success: true,
      data: {
        assets: flushingAssets,
        count: flushingAssets.length,
        description: "ACTIVE/MAINTENANCE assets that require flushing or are low usage"
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching flushing list report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch flushing list report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
