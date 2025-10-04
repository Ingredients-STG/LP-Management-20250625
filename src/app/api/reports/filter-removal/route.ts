import { NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET() {
  try {
    console.log('GET /api/reports/filter-removal: Starting request');
    
    // Get all assets from the database
    const allAssets = await DynamoDBService.getAllAssets();
    console.log(`Found ${allAssets.length} total assets in database`);

    // Filter Removal List - Active assets with filters that don't need filters and don't need flushing
    // Logic: ACTIVE && !filterNeeded && !needFlushing && filtersOn
    const filterRemovalAssets = allAssets.filter(asset => {
      const isActive = asset.status === 'ACTIVE';
      const filterNeeded = typeof asset.filterNeeded === 'boolean' ? asset.filterNeeded : (asset.filterNeeded?.toString().toLowerCase() === 'true' || asset.filterNeeded?.toString().toLowerCase() === 'yes');
      const needFlushing = typeof asset.needFlushing === 'boolean' ? asset.needFlushing : (asset.needFlushing?.toString().toLowerCase() === 'true' || asset.needFlushing?.toString().toLowerCase() === 'yes');
      const filtersOn = typeof asset.filtersOn === 'boolean' ? asset.filtersOn : (asset.filtersOn?.toString().toLowerCase() === 'true' || asset.filtersOn?.toString().toLowerCase() === 'yes');
      
      return isActive && !filterNeeded && !needFlushing && filtersOn;
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

    console.log(`Found ${filterRemovalAssets.length} assets for filter removal`);

    return NextResponse.json({
      success: true,
      data: {
        assets: filterRemovalAssets,
        count: filterRemovalAssets.length,
        description: "ACTIVE assets with filters to be removed (Filter Needed: No, Need Flushing: No, Filters On: Yes)"
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching filter removal report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch filter removal report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
