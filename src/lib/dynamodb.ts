import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand 
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
  filterNeeded: boolean;
  filtersOn: boolean;
  filterExpiryDate: string;
  filterInstalledOn: string;
  notes: string;
  augmentedCare: boolean;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
}

export class DynamoDBService {
  // Get all assets
  static async getAllAssets(): Promise<Asset[]> {
    try {
      console.log('Fetching all assets from DynamoDB table:', TABLE_NAME);
      
      const command = new ScanCommand({
        TableName: TABLE_NAME,
      });
      
      const result = await dynamodb.send(command);
      console.log(`Found ${result.Items?.length || 0} assets`);
      return result.Items as Asset[] || [];
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

  // Create new asset
  static async createAsset(asset: Omit<Asset, 'id' | 'created' | 'modified'>): Promise<Asset> {
    try {
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
      const now = new Date().toISOString();
      const updateExpression = [];
      const expressionAttributeNames: { [key: string]: string } = {};
      const expressionAttributeValues: { [key: string]: any } = {};

      // Build update expression
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created') {
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
        filtersNeeded: assets.filter(a => a.filterNeeded === true).length,
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
} 