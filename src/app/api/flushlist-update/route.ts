import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { DynamoDBService } from '@/lib/dynamodb';

export async function POST(request: NextRequest) {
  try {
    console.log('=== FLUSHLIST UPDATE STARTED ===');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userEmail = formData.get('userEmail') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    console.log(`Processing flushlist file: ${file.name} for user: ${userEmail}`);

    // Read the file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`File contains ${jsonData.length} rows`);

    if (jsonData.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    // Extract asset barcodes from the uploaded file
    const uploadedBarcodes = new Set<string>();
    const invalidRows: string[] = [];

    jsonData.forEach((row: any, index: number) => {
      const rowNum = index + 2; // Excel row number (1-based + header)
      const barcode = row['Asset Barcode']?.toString().trim();
      
      if (!barcode) {
        invalidRows.push(`Row ${rowNum}: Missing Asset Barcode`);
        return;
      }
      
      uploadedBarcodes.add(barcode);
      console.log(`Row ${rowNum}: Found barcode ${barcode}`);
    });

    if (invalidRows.length > 0) {
      console.log('Invalid rows found:', invalidRows);
      return NextResponse.json({ 
        error: 'Invalid data found', 
        details: invalidRows 
      }, { status: 400 });
    }

    console.log(`Processing ${uploadedBarcodes.size} unique barcodes`);

    // Get all assets from the database
    console.log('Fetching all assets from database...');
    const allAssets = await DynamoDBService.getAllAssets();
    console.log(`Found ${allAssets.length} total assets in database`);

    // Track changes for audit logging
    const auditEntries: any[] = [];
    let updatedCount = 0;
    let notFoundBarcodes: string[] = [];
    let errorDetails: string[] = [];

    // Process all assets
    for (const asset of allAssets) {
      try {
        const shouldFlush = uploadedBarcodes.has(asset.assetBarcode);
        const currentNeedFlushing = asset.needFlushing === true || asset.needFlushing === 'true';
        
        // Only update if the status needs to change
        if (shouldFlush !== currentNeedFlushing) {
          console.log(`Updating ${asset.assetBarcode}: needFlushing ${currentNeedFlushing} -> ${shouldFlush}`);
          
          // Update the asset
          await DynamoDBService.updateAsset(asset.assetBarcode, {
            needFlushing: shouldFlush,
            modified: new Date().toISOString(),
            modifiedBy: userEmail
          });

          // Create audit entry
          const auditEntry = {
            assetId: asset.id,
            timestamp: new Date().toISOString(),
            user: userEmail,
            action: 'FLUSHLIST_UPDATE',
            details: {
              assetBarcode: asset.assetBarcode,
              assetName: asset.assetName,
              changes: [{
                field: 'needFlushing',
                oldValue: currentNeedFlushing,
                newValue: shouldFlush
              }],
              flushlistUpdate: true,
              reason: shouldFlush ? 'Added to flushlist' : 'Removed from flushlist'
            }
          };

          auditEntries.push(auditEntry);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating asset ${asset.assetBarcode}:`, error);
        errorDetails.push(`Failed to update ${asset.assetBarcode}: ${error}`);
      }
    }

    // Check for barcodes that were in the upload but not found in database
    for (const barcode of uploadedBarcodes) {
      const found = allAssets.some(asset => asset.assetBarcode === barcode);
      if (!found) {
        notFoundBarcodes.push(barcode);
      }
    }

    // Log all audit entries
    console.log(`Creating ${auditEntries.length} audit entries...`);
    let auditEntriesCreated = 0;
    for (const entry of auditEntries) {
      try {
        await DynamoDBService.logAssetAuditEntry(entry);
        auditEntriesCreated++;
      } catch (error) {
        console.error('Error creating audit entry:', error);
      }
    }

    const results = {
      total: allAssets.length,
      updated: updatedCount,
      uploadedBarcodes: uploadedBarcodes.size,
      notFoundBarcodes: notFoundBarcodes,
      notFoundCount: notFoundBarcodes.length,
      errors: errorDetails.length,
      errorDetails: errorDetails,
      auditEntriesCreated: auditEntriesCreated
    };

    console.log('=== FLUSHLIST UPDATE COMPLETED ===');
    console.log('Results:', results);

    return NextResponse.json({
      success: true,
      message: `Flushlist updated successfully. ${updatedCount} assets updated.`,
      results: results
    });

  } catch (error) {
    console.error('Error processing flushlist update:', error);
    return NextResponse.json(
      { error: 'Failed to process flushlist update', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
