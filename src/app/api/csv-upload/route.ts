import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Configure DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const ddbClient = DynamoDBDocumentClient.from(client);

const ASSETS_TABLE = 'water-tap-assets';
const ASSET_TYPES_TABLE = 'AssetTypes';

function excelSerialToDate(serial: number): string {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return dateInfo.toISOString().split('T')[0]; // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');
    
    if (!isExcel && !isCsv) {
      return NextResponse.json({ 
        error: 'Only CSV and Excel (.xlsx, .xls) files are supported' 
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let data: any[] = [];

    if (isExcel) {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json<any>(sheet);
    } else {
      // Parse CSV file
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json<any>(sheet);
    }

    if (data.length === 0) {
      return NextResponse.json({ 
        error: 'File must contain at least one data row' 
      }, { status: 400 });
    }

    const results = {
      total: data.length,
      uploaded: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Get existing assets to check for duplicates
    const existingAssets = await ddbClient.send(new ScanCommand({
      TableName: ASSETS_TABLE,
      ProjectionExpression: 'assetBarcode'
    }));
    
    const existingBarcodes = new Set(
      existingAssets.Items?.map(item => item.assetBarcode?.toLowerCase()) || []
    );

    // Get existing asset types
    const existingAssetTypes = await ddbClient.send(new ScanCommand({
      TableName: ASSET_TYPES_TABLE,
      ProjectionExpression: '#label',
      ExpressionAttributeNames: { '#label': 'label' }
    }));
    
    const existingTypeLabels = new Set(
      existingAssetTypes.Items?.map(item => item.label) || []
    );

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Account for header row

      try {
        // Extract required fields with flexible header matching
        const assetBarcode = (
          row['Asset Barcode'] || 
          row['assetBarcode'] || 
          row['asset_barcode'] || 
          row['Barcode'] ||
          row['barcode']
        )?.toString().trim();

        const location = (
          row['Location'] || 
          row['Room'] || 
          row['room'] || 
          row['location']
        )?.toString().trim();

        const filterNeededRaw = (
          row['Filter Needed'] || 
          row['filterNeeded'] || 
          row['filter_needed'] ||
          row['Filter Required']
        )?.toString().toUpperCase();

        let filterInstalled = 
          row['Filter Installed'] || 
          row['filterInstalledOn'] || 
          row['filter_installed_on'] ||
          row['Filter Installed On'];

        const assetType = (
          row['Asset Type'] || 
          row['assetType'] || 
          row['asset_type'] ||
          row['Type'] ||
          row['type']
        )?.toString().trim();

        // Validate required fields
        if (!assetBarcode) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Asset Barcode is required`);
          continue;
        }

        if (!location) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Location is required`);
          continue;
        }

        if (!filterNeededRaw) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Filter Needed is required`);
          continue;
        }

        const filterNeeded = ['YES', 'TRUE', '1', 'Y'].includes(filterNeededRaw);

        // Validate filter installed date if filter is needed
        if (filterNeeded && !filterInstalled) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Filter Installed date is required when Filter Needed is YES`);
          continue;
        }

        // Check for duplicate barcode (case-insensitive)
        if (existingBarcodes.has(assetBarcode.toLowerCase())) {
          results.failed++;
          results.errors.push(`Row ${rowNum}: Barcode '${assetBarcode}' already exists`);
          continue;
        }

        // Convert Excel date serial if needed
        if (typeof filterInstalled === 'number') {
          filterInstalled = excelSerialToDate(filterInstalled);
        }

        // Calculate filter expiry (3 months from installation)
        let filterExpiry: string | undefined;
        if (filterInstalled && filterNeeded) {
          try {
            const installedDate = new Date(filterInstalled);
            if (isNaN(installedDate.getTime())) {
              results.failed++;
              results.errors.push(`Row ${rowNum}: Invalid Filter Installed date format`);
              continue;
            }
            installedDate.setMonth(installedDate.getMonth() + 3);
            filterExpiry = installedDate.toISOString().split('T')[0];
          } catch (error) {
            results.failed++;
            results.errors.push(`Row ${rowNum}: Error processing Filter Installed date`);
            continue;
          }
        }

        // Auto-create asset type if provided and doesn't exist
        if (assetType && !existingTypeLabels.has(assetType)) {
          try {
            await ddbClient.send(new PutCommand({
              TableName: ASSET_TYPES_TABLE,
              Item: { 
                typeId: `type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                label: assetType,
                createdBy: 'csv-upload',
                createdAt: new Date().toISOString()
              },
              ConditionExpression: 'attribute_not_exists(#label)',
              ExpressionAttributeNames: { '#label': 'label' }
            }));
            existingTypeLabels.add(assetType);
          } catch (err) {
            // Ignore if already exists (race condition)
            console.warn(`Asset type '${assetType}' may already exist:`, err);
          }
        }

        // Create asset record
        const assetId = `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        const assetData = {
          id: assetId,
          assetBarcode,
          room: location, // Using 'room' field as per existing schema
          assetType: assetType || '',
          filterNeeded,
          filterInstalledOn: filterInstalled || '',
          filterExpiryDate: filterExpiry || '',
          filtersOn: false,
          status: 'ACTIVE',
          primaryIdentifier: assetBarcode, // Default to barcode
          secondaryIdentifier: '',
          wing: '',
          wingInShort: '',
          floor: '',
          floorInWords: '',
          roomNo: '',
          roomName: '',
          notes: '',
          augmentedCare: false,
          created: now,
          createdBy: 'csv-upload',
          modified: now,
          modifiedBy: 'csv-upload'
        };

        await ddbClient.send(new PutCommand({
          TableName: ASSETS_TABLE,
          Item: assetData
        }));

        // Add to existing barcodes to prevent duplicates within same upload
        existingBarcodes.add(assetBarcode.toLowerCase());
        results.uploaded++;

      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`Error processing row ${rowNum}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        total: results.total,
        uploaded: results.uploaded,
        failed: results.failed,
        errors: results.errors.slice(0, 20) // Limit to first 20 errors
      }
    });

  } catch (err) {
    console.error('CSV Upload Error:', err);
    return NextResponse.json({ 
      success: false,
      error: 'Upload failed. Please try again.' 
    }, { status: 500 });
  }
} 