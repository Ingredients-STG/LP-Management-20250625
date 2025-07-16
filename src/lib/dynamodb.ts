import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  QueryCommand,
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { 
  CreateTableCommand, 
  DescribeTableCommand, 
  waitUntilTableExists 
} from '@aws-sdk/client-dynamodb';

// Configure AWS SDK v3 with environment variables
const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'water-tap-assets';
const AUDIT_TABLE_NAME = 'AssetAuditLogs';
const ASSET_TYPES_TABLE_NAME = 'AssetTypes';

export interface Asset {
  id: string;
  assetBarcode: string;
  status: string;
  assetType: string;
  primaryIdentifier: string;
  secondaryIdentifier: string;
  wing: string;
  wingInShort: string;
  room: string;
  floor: string;
  floorInWords: string;
  roomNo: string;
  roomName: string;
  filterNeeded: boolean | string;
  filtersOn: boolean | string;
  filterExpiryDate: string;
  filterInstalledOn: string;
  filterType: string;
  needFlushing: boolean | string;
  notes: string;
  augmentedCare: boolean | string;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}

export interface AuditLogEntry {
  assetId: string;
  timestamp: string;
  user: string;
  action: string;
  details?: any;
}

export interface AssetType {
  typeId: string;
  label: string;
  createdBy?: string;
  createdAt: string;
}

export class DynamoDBService {
  // Get all assets
  static async getAllAssets(): Promise<Asset[]> {
    try {
      console.log('Fetching all assets from DynamoDB table:', TABLE_NAME);
      
      const allAssets: Asset[] = [];
      let lastEvaluatedKey: any = undefined;
      
      do {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100 // Process in batches to avoid memory issues
      });
      
      const result = await dynamodb.send(command);
        
        if (result.Items && result.Items.length > 0) {
          allAssets.push(...(result.Items as Asset[]));
          console.log(`Fetched ${result.Items.length} assets (total so far: ${allAssets.length})`);
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
      } while (lastEvaluatedKey);
      
      console.log(`Found ${allAssets.length} total assets`);
      return allAssets;
    } catch (error) {
      console.error('Error getting assets:', error);
      console.error('AWS Config:', {
        region: 'eu-west-2',
        hasAccessKey: !!process.env.AMPLIFY_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AMPLIFY_SECRET_ACCESS_KEY,
      });
      throw error;
    }
  }

  // Get asset by ID
  static async getAssetById(id: string): Promise<Asset | null> {
    try {
      const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      });
      
      const result = await dynamodb.send(command);
      return result.Item as Asset || null;
    } catch (error) {
      console.error('Error getting asset by ID:', error);
      throw error;
    }
  }

  // Check if asset barcode already exists
  static async getAssetByBarcode(assetBarcode: string): Promise<Asset | null> {
    try {
      const command = new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'assetBarcode = :barcode',
        ExpressionAttributeValues: {
          ':barcode': assetBarcode,
        },
      });
      
      const result = await dynamodb.send(command);
      return result.Items && result.Items.length > 0 ? result.Items[0] as Asset : null;
    } catch (error) {
      console.error('Error checking asset barcode:', error);
      throw error;
    }
  }

  // Create new asset
  static async createAsset(asset: Omit<Asset, 'id' | 'created' | 'modified'>): Promise<Asset> {
    try {
      // Validate required fields
      if (!asset.assetBarcode || asset.assetBarcode.trim() === '') {
        throw new Error('Asset barcode is required');
      }

      // Check if asset barcode already exists
      const existingAsset = await this.getAssetByBarcode(asset.assetBarcode);
      if (existingAsset) {
        throw new Error(`Asset with barcode "${asset.assetBarcode}" already exists`);
      }

      const now = new Date().toISOString();
      const newAsset: Asset = {
        ...asset,
        id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        created: now,
        modified: now,
      };

      const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: newAsset,
      });

      await dynamodb.send(command);
      return newAsset;
    } catch (error) {
      console.error('Error creating asset:', error);
      throw error;
    }
  }

  // Update existing asset
  static async updateAsset(id: string, updates: Partial<Asset>): Promise<Asset> {
    try {
      // If asset barcode is being updated, check for duplicates
      if (updates.assetBarcode) {
        if (updates.assetBarcode.trim() === '') {
          throw new Error('Asset barcode cannot be empty');
        }
        
        const existingAsset = await this.getAssetByBarcode(updates.assetBarcode);
        if (existingAsset && existingAsset.id !== id) {
          throw new Error(`Asset with barcode "${updates.assetBarcode}" already exists`);
        }
      }

      const now = new Date().toISOString();
      const updateExpression = [];
      const expressionAttributeNames: { [key: string]: string } = {};
      const expressionAttributeValues: { [key: string]: any } = {};

      // Build update expression
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created' && key !== 'modified') {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      }

      // Always update the modified timestamp
      updateExpression.push('#modified = :modified');
      expressionAttributeNames['#modified'] = 'modified';
      expressionAttributeValues[':modified'] = now;

      const command = new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result = await dynamodb.send(command);
      return result.Attributes as Asset;
    } catch (error) {
      console.error('Error updating asset:', error);
      throw error;
    }
  }

  // Delete asset
  static async deleteAsset(id: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
      });

      await dynamodb.send(command);
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw error;
    }
  }

  // Get dashboard statistics
  static async getDashboardStats(): Promise<any> {
    try {
      const assets = await this.getAllAssets();
      
      const stats = {
        totalAssets: assets.length,
        activeAssets: assets.filter(a => a.status === 'ACTIVE').length,
        maintenanceAssets: assets.filter(a => a.status === 'MAINTENANCE').length,
        filtersNeeded: assets.filter(a => {
          if (typeof a.filterNeeded === 'boolean') {
            return a.filterNeeded;
          }
          const filterNeededStr = a.filterNeeded?.toString().toLowerCase();
          return filterNeededStr === 'true' || filterNeededStr === 'yes';
        }).length,
        statusBreakdown: {} as { [key: string]: number },
        assetTypeBreakdown: {} as { [key: string]: number },
        wingBreakdown: {} as { [key: string]: number },
      };

      // Calculate breakdowns
      assets.forEach(asset => {
        // Status breakdown
        stats.statusBreakdown[asset.status] = (stats.statusBreakdown[asset.status] || 0) + 1;
        
        // Asset type breakdown
        stats.assetTypeBreakdown[asset.assetType] = (stats.assetTypeBreakdown[asset.assetType] || 0) + 1;
        
        // Wing breakdown
        const wing = asset.wing || 'Unknown';
        stats.wingBreakdown[wing] = (stats.wingBreakdown[wing] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  // Create table if it doesn't exist
  static async createTableIfNotExists(): Promise<void> {
    try {
      // Check if table exists
      try {
        const command = new DescribeTableCommand({ TableName: TABLE_NAME });
        await client.send(command);
        console.log(`Table ${TABLE_NAME} already exists`);
        return;
      } catch (error: any) {
        if (error.name !== 'ResourceNotFoundException') {
          throw error;
        }
      }

      // Create table
      const createCommand = new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      });

      console.log(`Creating table ${TABLE_NAME}...`);
      await client.send(createCommand);
      
      // Wait for table to be active
      await waitUntilTableExists(
        { client, maxWaitTime: 300 },
        { TableName: TABLE_NAME }
      );
      console.log(`Table ${TABLE_NAME} created successfully`);
    } catch (error) {
      console.error('Error creating table:', error);
      throw error;
    }
  }

  // Create audit table if it doesn't exist
  static async createAuditTableIfNotExists(): Promise<void> {
    try {
      // Check if table exists
      const describeCommand = new DescribeTableCommand({
        TableName: AUDIT_TABLE_NAME,
      });
      
      await client.send(describeCommand);
      console.log(`Audit table ${AUDIT_TABLE_NAME} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Creating audit table ${AUDIT_TABLE_NAME}...`);
        
        const createCommand = new CreateTableCommand({
          TableName: AUDIT_TABLE_NAME,
          KeySchema: [
            {
              AttributeName: 'assetId',
              KeyType: 'HASH', // Partition key
            },
            {
              AttributeName: 'timestamp',
              KeyType: 'RANGE', // Sort key
            },
          ],
          AttributeDefinitions: [
            {
              AttributeName: 'assetId',
              AttributeType: 'S',
            },
            {
              AttributeName: 'timestamp',
              AttributeType: 'S',
            },
          ],
          BillingMode: 'PAY_PER_REQUEST',
        });

        await client.send(createCommand);
        
        // Wait for table to be created
        await waitUntilTableExists(
          { client, maxWaitTime: 60 },
          { TableName: AUDIT_TABLE_NAME }
        );
        
        console.log(`Audit table ${AUDIT_TABLE_NAME} created successfully`);
      } else {
        console.error('Error checking/creating audit table:', error);
        throw error;
      }
    }
  }

  // Create audit log entry
  static async logAssetAuditEntry(auditEntry: AuditLogEntry): Promise<void> {
    try {
      await this.createAuditTableIfNotExists();
      
      // Clean the audit entry to remove undefined values
      const cleanAuditEntry = this.cleanObjectForDynamoDB(auditEntry);
      
      const command = new PutCommand({
        TableName: AUDIT_TABLE_NAME,
        Item: cleanAuditEntry,
      });

      await dynamodb.send(command);
      console.log('Audit entry logged successfully');
    } catch (error) {
      console.error('Error logging audit entry:', error);
      throw error;
    }
  }

  // Helper function to clean objects for DynamoDB (remove undefined values)
  private static cleanObjectForDynamoDB(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanObjectForDynamoDB(item)).filter(item => item !== null);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = this.cleanObjectForDynamoDB(value);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  // Get asset audit entries with pagination
  static async getAssetAuditEntriesPaginated(
    assetId: string, 
    limit: number = 100, 
    lastEvaluatedKey?: any
  ): Promise<{ entries: AuditLogEntry[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    try {
      await this.createAuditTableIfNotExists();
      
      console.log('Fetching audit entries for assetId:', assetId);
      
      // Use QueryCommand instead of ScanCommand for efficient retrieval
      const command = new QueryCommand({
        TableName: AUDIT_TABLE_NAME,
        KeyConditionExpression: 'assetId = :assetId',
        ExpressionAttributeValues: {
          ':assetId': assetId,
        },
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: false, // Sort in descending order (newest first)
      });

      const result = await dynamodb.send(command);
      const entries = (result.Items as AuditLogEntry[]) || [];
      
      console.log('Found audit entries for asset:', entries.length);
      
      // Since we're using ScanIndexForward: false, entries are already sorted newest first
      // But we still need to clean timestamps for consistent sorting
      const sortedEntries = entries.sort((a, b) => {
        // Clean timestamps by removing any extra characters after the Z
        const cleanTimestampA = a.timestamp.split('-')[0]; // Remove any suffix after Z
        const cleanTimestampB = b.timestamp.split('-')[0]; // Remove any suffix after Z
        
        const timeA = new Date(cleanTimestampA).getTime();
        const timeB = new Date(cleanTimestampB).getTime();
        return timeB - timeA; // Descending order (newest first)
      });
      
      return {
        entries: sortedEntries,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: !!result.LastEvaluatedKey
      };
    } catch (error) {
      console.error('Error getting paginated audit entries:', error);
      throw error;
    }
  }

  // Get all audit entries with pagination
  static async getAllAuditEntriesPaginated(
    limit: number = 100, 
    lastEvaluatedKey?: any
  ): Promise<{ entries: AuditLogEntry[]; lastEvaluatedKey?: any; hasMore: boolean }> {
    try {
      await this.createAuditTableIfNotExists();
      
      // Use a much larger scan to ensure we get the latest entries
      const command = new ScanCommand({
        TableName: AUDIT_TABLE_NAME,
        Limit: Math.max(limit * 10, 5000), // Get many more items to ensure we have the latest
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result = await dynamodb.send(command);
      const entries = (result.Items as AuditLogEntry[]) || [];
      
      console.log('Global audit entries found:', entries.length);
      if (entries.length > 0) {
        console.log('Sample timestamps:', entries.slice(0, 3).map(e => e.timestamp));
        console.log('Sample asset IDs:', entries.slice(0, 3).map(e => e.assetId));
      }
      
      // Debug: print any entry with a July 16th timestamp
      const july16Entries = entries.filter(e => e.timestamp.includes('2025-07-16'));
      if (july16Entries.length > 0) {
        console.log('Found July 16th entries:', july16Entries.map(e => e.timestamp));
      } else {
        console.log('No July 16th entries found in scan results.');
      }

      // Improved sorting: handle timestamps with suffixes properly
      const sortedEntries = entries.sort((a, b) => {
        // Clean timestamps by removing any extra characters after the Z
        const cleanTimestampA = a.timestamp.split('-')[0]; // Remove any suffix after Z
        const cleanTimestampB = b.timestamp.split('-')[0]; // Remove any suffix after Z
        
        const timeA = new Date(cleanTimestampA).getTime();
        const timeB = new Date(cleanTimestampB).getTime();
        return timeB - timeA; // Descending order (newest first)
      });
      
      // Debug: print the top 10 timestamps after sorting
      console.log('Top 10 timestamps after sorting:', sortedEntries.slice(0, 10).map(e => e.timestamp));
      
      console.log('After sorting - first entry timestamp:', sortedEntries[0]?.timestamp);
      
      // Return only the requested limit
      const limitedEntries = sortedEntries.slice(0, limit);
      
      return {
        entries: limitedEntries,
        lastEvaluatedKey: result.LastEvaluatedKey,
        hasMore: result.LastEvaluatedKey !== undefined || sortedEntries.length > limit
      };
    } catch (error) {
      console.error('Error getting paginated all audit entries:', error);
      throw error;
    }
  }

  // Get asset audit entries (legacy method - loads all)
  static async getAssetAuditEntries(assetId: string): Promise<AuditLogEntry[]> {
    try {
      await this.createAuditTableIfNotExists();
      
      const command = new QueryCommand({
        TableName: AUDIT_TABLE_NAME,
        KeyConditionExpression: 'assetId = :assetId',
        ExpressionAttributeValues: {
          ':assetId': assetId,
        },
        ScanIndexForward: false, // Sort in descending order (newest first)
      });

      const result = await dynamodb.send(command);
      const entries = (result.Items as AuditLogEntry[]) || [];
      
      // Sort by timestamp descending (newest first) with timestamp cleaning
      return entries.sort((a, b) => {
        // Clean timestamps by removing any extra characters after the Z
        const cleanTimestampA = a.timestamp.split('-')[0]; // Remove any suffix after Z
        const cleanTimestampB = b.timestamp.split('-')[0]; // Remove any suffix after Z
        
        const timeA = new Date(cleanTimestampA).getTime();
        const timeB = new Date(cleanTimestampB).getTime();
        return timeB - timeA; // Descending order (newest first)
      });
    } catch (error) {
      console.error('Error getting audit entries:', error);
      throw error;
    }
  }

  // Get all audit entries (legacy method - loads all)
  static async getAllAuditEntries(): Promise<AuditLogEntry[]> {
    try {
      await this.createAuditTableIfNotExists();
      
      const allEntries: AuditLogEntry[] = [];
      let lastEvaluatedKey: any = undefined;
      
      do {
      const command = new ScanCommand({
        TableName: AUDIT_TABLE_NAME,
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100
      });

      const result = await dynamodb.send(command);
        
        if (result.Items && result.Items.length > 0) {
          allEntries.push(...(result.Items as AuditLogEntry[]));
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
      } while (lastEvaluatedKey);
      
      // Sort by timestamp descending (newest first)
      return allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Error getting all audit entries:', error);
      throw error;
    }
  }

  // Delete all audit entries (reset audit log)
  static async deleteAllAuditEntries(): Promise<void> {
    try {
      await this.createAuditTableIfNotExists();
      
      console.log('Starting to delete all audit entries...');
      
      // Get all audit entries first
      const allEntries = await this.getAllAuditEntries();
      console.log(`Found ${allEntries.length} audit entries to delete`);
      
      // Delete entries in batches
      const batchSize = 25; // DynamoDB batch delete limit
      for (let i = 0; i < allEntries.length; i += batchSize) {
        const batch = allEntries.slice(i, i + batchSize);
        
        const deleteRequests = batch.map(entry => ({
          DeleteRequest: {
            Key: {
              assetId: entry.assetId,
              timestamp: entry.timestamp
            }
          }
        }));
        
        const command = new BatchWriteCommand({
          RequestItems: {
            [AUDIT_TABLE_NAME]: deleteRequests
          }
        });
        
        await dynamodb.send(command);
        console.log(`Deleted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(allEntries.length / batchSize)}`);
      }
      
      console.log('Successfully deleted all audit entries');
    } catch (error) {
      console.error('Error deleting all audit entries:', error);
      throw error;
    }
  }

  // Asset Types Management
  
  // Create asset types table if it doesn't exist
  static async createAssetTypesTableIfNotExists(): Promise<void> {
    try {
      // Check if table exists
      const describeCommand = new DescribeTableCommand({
        TableName: ASSET_TYPES_TABLE_NAME,
      });
      
      await client.send(describeCommand);
      console.log(`Asset types table ${ASSET_TYPES_TABLE_NAME} already exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`Creating asset types table ${ASSET_TYPES_TABLE_NAME}...`);
        
        const createCommand = new CreateTableCommand({
          TableName: ASSET_TYPES_TABLE_NAME,
          KeySchema: [
            {
              AttributeName: 'typeId',
              KeyType: 'HASH', // Partition key
            },
          ],
          AttributeDefinitions: [
            {
              AttributeName: 'typeId',
              AttributeType: 'S',
            },
          ],
          BillingMode: 'PAY_PER_REQUEST',
        });

        await client.send(createCommand);
        
        // Wait for table to be created
        await waitUntilTableExists(
          { client, maxWaitTime: 60 },
          { TableName: ASSET_TYPES_TABLE_NAME }
        );
        
        console.log(`Asset types table ${ASSET_TYPES_TABLE_NAME} created successfully`);
        
        // Add default asset types
        await this.seedDefaultAssetTypes();
      } else {
        console.error('Error checking/creating asset types table:', error);
        throw error;
      }
    }
  }

  // Seed default asset types
  static async seedDefaultAssetTypes(): Promise<void> {
    const defaultTypes = [
      'Water Tap',
      'Water Cooler', 
      'LNS Outlet - TMT',
      'LNS Shower - TMT'
    ];

    for (const label of defaultTypes) {
      await this.createAssetType(label, 'system');
    }
  }

  // Get all asset types
  static async getAllAssetTypes(): Promise<AssetType[]> {
    try {
      await this.createAssetTypesTableIfNotExists();
      
      const allAssetTypes: AssetType[] = [];
      let lastEvaluatedKey: any = undefined;
      
      do {
      const command = new ScanCommand({
        TableName: ASSET_TYPES_TABLE_NAME,
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100
      });
      
      const result = await dynamodb.send(command);
        
        if (result.Items && result.Items.length > 0) {
          allAssetTypes.push(...(result.Items as AssetType[]));
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
      } while (lastEvaluatedKey);
      
      // Sort by label alphabetically
      return allAssetTypes.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Error getting asset types:', error);
      throw error;
    }
  }

  // Create new asset type
  static async createAssetType(label: string, createdBy: string = 'user'): Promise<AssetType> {
    try {
      await this.createAssetTypesTableIfNotExists();
      
      // Check if asset type already exists
      const existingTypes = await this.getAllAssetTypes();
      const existing = existingTypes.find(type => type.label.toLowerCase() === label.toLowerCase());
      
      if (existing) {
        throw new Error('Asset type already exists');
      }
      
      const newAssetType: AssetType = {
        typeId: `type-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        label: label.trim(),
        createdBy,
        createdAt: new Date().toISOString(),
      };

      const command = new PutCommand({
        TableName: ASSET_TYPES_TABLE_NAME,
        Item: newAssetType,
      });

      await dynamodb.send(command);
      return newAssetType;
    } catch (error) {
      console.error('Error creating asset type:', error);
      throw error;
    }
  }

  // Update asset type
  static async updateAssetType(typeId: string, label: string): Promise<AssetType> {
    try {
      // Check if new label already exists (excluding current type)
      const existingTypes = await this.getAllAssetTypes();
      const existing = existingTypes.find(type => 
        type.label.toLowerCase() === label.toLowerCase() && type.typeId !== typeId
      );
      
      if (existing) {
        throw new Error('Asset type with this label already exists');
      }

      const command = new UpdateCommand({
        TableName: ASSET_TYPES_TABLE_NAME,
        Key: { typeId },
        UpdateExpression: 'SET #label = :label',
        ExpressionAttributeNames: {
          '#label': 'label',
        },
        ExpressionAttributeValues: {
          ':label': label.trim(),
        },
        ReturnValues: 'ALL_NEW',
      });

      const result = await dynamodb.send(command);
      return result.Attributes as AssetType;
    } catch (error) {
      console.error('Error updating asset type:', error);
      throw error;
    }
  }

  // Delete asset type
  static async deleteAssetType(typeId: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: ASSET_TYPES_TABLE_NAME,
        Key: { typeId },
      });

      await dynamodb.send(command);
    } catch (error) {
      console.error('Error deleting asset type:', error);
      throw error;
    }
  }
} 