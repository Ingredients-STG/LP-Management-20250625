import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBService } from '@/lib/dynamodb';

export async function GET() {
  try {
    console.log('=== IDENTIFYING BLANK ASSETS ===');
    
    // Get all assets from the database
    const allAssets = await DynamoDBService.getAllAssets();
    console.log(`Found ${allAssets.length} total assets in database`);

    // Identify blank/incomplete assets
    const blankAssets = allAssets.filter(asset => {
      // Consider an asset "blank" if it has:
      // 1. Only assetBarcode and system fields (id, created, modified, createdBy, modifiedBy)
      // 2. OR has mostly empty/default values for important fields
      
      const importantFields = [
        'primaryIdentifier', 'secondaryIdentifier', 'assetType', 'room', 
        'wing', 'floor', 'roomName', 'status'
      ];
      
      const hasImportantData = importantFields.some(field => {
        const value = asset[field];
        return value && value.toString().trim() !== '' && value !== 'undefined' && value !== 'null';
      });
      
      // Also check if it was created by bulk-upload recently (likely the problematic ones)
      const isBulkUploaded = asset.createdBy === 'bulk-upload';
      
      // Consider it blank if:
      // 1. No important data AND was bulk uploaded
      // 2. OR only has assetBarcode and nothing else meaningful
      const isBlank = (!hasImportantData && isBulkUploaded) || 
                     (!hasImportantData && !asset.primaryIdentifier);
      
      if (isBlank) {
        console.log(`Blank asset found: ${asset.assetBarcode} (ID: ${asset.id})`);
      }
      
      return isBlank;
    });

    console.log(`Found ${blankAssets.length} blank assets`);

    // Return detailed information about blank assets
    const blankAssetDetails = blankAssets.map(asset => ({
      id: asset.id,
      assetBarcode: asset.assetBarcode,
      createdBy: asset.createdBy || '(unknown)',
      created: asset.created || '(unknown)',
      modified: asset.modified || '(unknown)',
      modifiedBy: asset.modifiedBy || '(unknown)',
      primaryIdentifier: asset.primaryIdentifier || '(empty)',
      assetType: asset.assetType || '(empty)',
      room: asset.room || '(empty)',
      status: asset.status || '(empty)',
      wing: asset.wing || '(empty)',
      floor: asset.floor || '(empty)'
    }));

    // Group by creation method for analysis
    const creationAnalysis = blankAssets.reduce((acc: any, asset) => {
      const creator = asset.createdBy || 'unknown';
      if (!acc[creator]) {
        acc[creator] = [];
      }
      acc[creator].push(asset.assetBarcode);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      message: `Found ${blankAssets.length} blank assets`,
      totalAssets: allAssets.length,
      blankAssets: blankAssets.length,
      creationAnalysis: creationAnalysis,
      blankAssetDetails: blankAssetDetails.slice(0, 10) // Show first 10 for readability
    });

  } catch (error) {
    console.error('Error identifying blank assets:', error);
    return NextResponse.json(
      { error: 'Failed to identify blank assets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm');
    
    if (confirm !== 'true') {
      return NextResponse.json(
        { error: 'Confirmation required. Add ?confirm=true to proceed with deletion.' },
        { status: 400 }
      );
    }

    console.log('=== DELETING BLANK ASSETS ===');
    
    // Get all assets from the database
    const allAssets = await DynamoDBService.getAllAssets();
    
    // Identify blank/incomplete assets (same logic as GET)
    const blankAssets = allAssets.filter(asset => {
      const importantFields = [
        'primaryIdentifier', 'secondaryIdentifier', 'assetType', 'room', 
        'wing', 'floor', 'roomName', 'status'
      ];
      
      const hasImportantData = importantFields.some(field => {
        const value = asset[field];
        return value && value.toString().trim() !== '' && value !== 'undefined' && value !== 'null';
      });
      
      const isBulkUploaded = asset.createdBy === 'bulk-upload';
      return (!hasImportantData && isBulkUploaded) || 
             (!hasImportantData && !asset.primaryIdentifier);
    });

    console.log(`Deleting ${blankAssets.length} blank assets...`);

    const deletionResults = {
      attempted: blankAssets.length,
      succeeded: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Delete each blank asset
    for (const asset of blankAssets) {
      try {
        console.log(`Deleting blank asset: ${asset.assetBarcode} (ID: ${asset.id})`);
        
        // Delete the asset
        await DynamoDBService.deleteAsset(asset.id);
        
        // Log audit entry for deletion
        try {
          await DynamoDBService.logAssetAuditEntry({
            assetId: asset.id,
            timestamp: new Date().toISOString(),
            user: 'System Cleanup',
            action: 'DELETE',
            details: {
              assetBarcode: asset.assetBarcode,
              assetName: asset.primaryIdentifier || '(blank)',
              reason: 'Automatic cleanup of blank/incomplete assets',
              changes: []
            }
          });
        } catch (auditError) {
          console.warn(`Failed to log audit entry for deleted asset ${asset.assetBarcode}:`, auditError);
        }
        
        deletionResults.succeeded++;
        
      } catch (error) {
        console.error(`Failed to delete asset ${asset.assetBarcode}:`, error);
        deletionResults.failed++;
        deletionResults.errors.push(`Failed to delete ${asset.assetBarcode}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('=== BLANK ASSET CLEANUP COMPLETED ===');
    console.log('Results:', deletionResults);

    return NextResponse.json({
      success: true,
      message: `Blank asset cleanup completed. Deleted ${deletionResults.succeeded} assets.`,
      results: deletionResults
    });

  } catch (error) {
    console.error('Error deleting blank assets:', error);
    return NextResponse.json(
      { error: 'Failed to delete blank assets', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
