import { NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET() {
  try {
    console.log('GET /api/reports/filter-expiry: Starting request');
    
    // Get all assets from the database
    const allAssets = await DynamoDBService.getAllAssets();
    console.log(`Found ${allAssets.length} total assets in database`);

    // Helper function to get current week range (Monday to Sunday)
    const getCurrentWeekRange = () => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is day 1
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      return { startOfWeek, endOfWeek };
    };

    // Filter Expiry List - Active assets with filters that are expired or expiring this week
    // Logic: (expired OR expiring this week) AND Filter Needed = Yes AND Filters On = Yes AND Status = ACTIVE
    const { startOfWeek, endOfWeek } = getCurrentWeekRange();
    
    const filterExpiryAssets = allAssets.filter(asset => {
      // Must have filter expiry date
      if (!asset.filterExpiryDate) return false;
      
      const expiryDate = new Date(asset.filterExpiryDate);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      const isExpiringThisWeek = expiryDate >= startOfWeek && expiryDate <= endOfWeek;
      
      // Filter criteria: (expired OR expiring this week) AND Filter Needed = Yes AND Filters On = Yes AND Status = ACTIVE
      return (
        (daysUntilExpiry <= 0 || isExpiringThisWeek) && // Already expired OR expiring this week
        (asset.filterNeeded === true || asset.filterNeeded === 'YES' || asset.filterNeeded === 'true') && // Filter Needed = Yes
        (asset.filtersOn === true || asset.filtersOn === 'YES' || asset.filtersOn === 'true') && // Filters On = Yes
        asset.status === 'ACTIVE' // Status = ACTIVE only
      );
    }).sort((a, b) => {
      // Sort by Room field
      const roomA = (a.room || '').toString().toLowerCase();
      const roomB = (b.room || '').toString().toLowerCase();
      return roomA.localeCompare(roomB);
    });

    console.log(`Found ${filterExpiryAssets.length} assets for filter expiry`);

    return NextResponse.json({
      success: true,
      data: {
        assets: filterExpiryAssets,
        count: filterExpiryAssets.length,
        description: "ACTIVE assets with filters that are expired or expiring this week (Monday to Sunday)"
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching filter expiry report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch filter expiry report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
