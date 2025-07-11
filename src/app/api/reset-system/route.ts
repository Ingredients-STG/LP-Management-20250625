import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getCurrentUser } from '@/lib/utils';

// Configure AWS clients
const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const ddbClient = DynamoDBDocumentClient.from(client);

const s3Client = new S3Client({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

// Table names
const TABLES = {
  ASSETS: 'water-tap-assets',
  ASSET_TYPES: 'AssetTypes',
  FILTER_TYPES: 'FilterTypes',
  AUDIT_LOGS: 'AssetAuditLogs'
};

// S3 bucket name
const BUCKET_NAME = `asset-files-${process.env.NODE_ENV || 'dev'}`;

// Function to clear all items from a DynamoDB table
async function clearTable(tableName: string, keySchema: { name: string; type: 'HASH' | 'RANGE' }[]) {
  try {
    console.log(`Clearing table: ${tableName}`);
    
    let totalDeleted = 0;
    let lastEvaluatedKey: any = undefined;
    
    do {
      // Scan to get items with pagination
      const scanCommand = new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100 // Process in smaller batches to avoid timeouts
      });
      
      const result = await ddbClient.send(scanCommand);
      
      if (!result.Items || result.Items.length === 0) {
        console.log(`No more items found in ${tableName}`);
        break;
      }
      
      console.log(`Found ${result.Items.length} items in ${tableName} (batch)`);
      
      // Delete items in batches
      const deletePromises = result.Items.map(item => {
        const key: any = {};
        keySchema.forEach(keyDef => {
          key[keyDef.name] = item[keyDef.name];
        });
        
        return ddbClient.send(new DeleteCommand({
          TableName: tableName,
          Key: key
        }));
      });
      
      await Promise.all(deletePromises);
      
      totalDeleted += result.Items.length;
      lastEvaluatedKey = result.LastEvaluatedKey;
      
      console.log(`Deleted ${result.Items.length} items from ${tableName} (total so far: ${totalDeleted})`);
      
    } while (lastEvaluatedKey);
    
    console.log(`Completed clearing ${tableName}. Total deleted: ${totalDeleted}`);
    return { deleted: totalDeleted };
    
  } catch (error) {
    console.error(`Error clearing table ${tableName}:`, error);
    throw error;
  }
}

// Function to clear all objects from S3 bucket
async function clearS3Bucket() {
  try {
    console.log(`Clearing S3 bucket: ${BUCKET_NAME}`);
    
    // List all objects in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
    });
    
    const result = await s3Client.send(listCommand);
    
    if (!result.Contents || result.Contents.length === 0) {
      console.log(`S3 bucket ${BUCKET_NAME} is already empty`);
      return { deleted: 0 };
    }
    
    // Delete all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: result.Contents.map(obj => ({ Key: obj.Key! })),
      },
    });
    
    await s3Client.send(deleteCommand);
    
    console.log(`Deleted ${result.Contents.length} objects from S3 bucket`);
    return { deleted: result.Contents.length };
    
  } catch (error) {
    console.error(`Error clearing S3 bucket:`, error);
    // Don't throw error for S3 - bucket might not exist or be empty
    return { deleted: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Function to reseed default data
async function reseedDefaultData() {
  try {
    console.log('Reseeding default data...');
    
    // Default asset types
    const defaultAssetTypes = [
      { typeId: 'water-tap', label: 'Water Tap', createdAt: new Date().toISOString(), createdBy: 'system' },
      { typeId: 'water-cooler', label: 'Water Cooler', createdAt: new Date().toISOString(), createdBy: 'system' },
      { typeId: 'lns-outlet-tmt', label: 'LNS Outlet - TMT', createdAt: new Date().toISOString(), createdBy: 'system' },
      { typeId: 'lns-shower-tmt', label: 'LNS Shower - TMT', createdAt: new Date().toISOString(), createdBy: 'system' }
    ];
    
    // Default filter types
    const defaultFilterTypes = [
      { typeId: 'standard', label: 'Standard', createdAt: new Date().toISOString(), createdBy: 'system' },
      { typeId: 'advanced', label: 'Advanced', createdAt: new Date().toISOString(), createdBy: 'system' },
      { typeId: 'premium', label: 'Premium', createdAt: new Date().toISOString(), createdBy: 'system' },
      { typeId: 'basic', label: 'Basic', createdAt: new Date().toISOString(), createdBy: 'system' }
    ];
    
    // Insert default asset types
    const assetTypePromises = defaultAssetTypes.map(assetType =>
      ddbClient.send(new PutCommand({
        TableName: TABLES.ASSET_TYPES,
        Item: assetType
      }))
    );
    
    // Insert default filter types
    const filterTypePromises = defaultFilterTypes.map(filterType =>
      ddbClient.send(new PutCommand({
        TableName: TABLES.FILTER_TYPES,
        Item: filterType
      }))
    );
    
    await Promise.all([...assetTypePromises, ...filterTypePromises]);
    
    console.log('Default data reseeded successfully');
    return {
      assetTypes: defaultAssetTypes.length,
      filterTypes: defaultFilterTypes.length
    };
    
  } catch (error) {
    console.error('Error reseeding default data:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user for audit purposes
    const currentUser = getCurrentUser();
    const userEmail = typeof currentUser === 'string' ? currentUser : ((currentUser as any)?.email || 'unknown');
    
    console.log(`System reset initiated by user: ${userEmail}`);
    
    // Parse request body for confirmation
    const body = await request.json();
    const { confirmationText, confirmed } = body;
    
    // Validate confirmation
    if (!confirmed || confirmationText !== 'RESET ALL DATA') {
      return NextResponse.json({
        success: false,
        error: 'Invalid confirmation. Please type "RESET ALL DATA" to confirm.'
      }, { status: 400 });
    }
    
    const resetResults = {
      tables: {} as Record<string, any>,
      s3: {} as any,
      reseeded: {} as any,
      timestamp: new Date().toISOString(),
      initiatedBy: userEmail
    };
    
    // Clear all DynamoDB tables
    console.log('Starting DynamoDB table cleanup...');
    
    // Clear main assets table
    resetResults.tables[TABLES.ASSETS] = await clearTable(TABLES.ASSETS, [
      { name: 'id', type: 'HASH' }
    ]);
    
    // Clear asset types table
    resetResults.tables[TABLES.ASSET_TYPES] = await clearTable(TABLES.ASSET_TYPES, [
      { name: 'typeId', type: 'HASH' }
    ]);
    
    // Clear filter types table
    resetResults.tables[TABLES.FILTER_TYPES] = await clearTable(TABLES.FILTER_TYPES, [
      { name: 'typeId', type: 'HASH' }
    ]);
    
    // Clear audit logs table
    resetResults.tables[TABLES.AUDIT_LOGS] = await clearTable(TABLES.AUDIT_LOGS, [
      { name: 'assetId', type: 'HASH' },
      { name: 'timestamp', type: 'RANGE' }
    ]);
    
    // Clear S3 bucket
    console.log('Starting S3 bucket cleanup...');
    resetResults.s3 = await clearS3Bucket();
    
    // Reseed default data
    console.log('Reseeding default data...');
    resetResults.reseeded = await reseedDefaultData();
    
    console.log('System reset completed successfully:', resetResults);
    
    return NextResponse.json({
      success: true,
      message: 'System reset completed successfully',
      data: resetResults
    });
    
  } catch (error) {
    console.error('System reset failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'System reset failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 