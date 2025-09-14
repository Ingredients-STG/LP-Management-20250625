import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  ScanCommand 
} from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as XLSX from 'xlsx';
import { DynamoDBService } from './dynamodb';

// Configure AWS SDK v3 with environment variables
const client = new DynamoDBClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);
const sesClient = new SESClient({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

const s3Client = new S3Client({
  region: process.env.AMPLIFY_AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AMPLIFY_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AMPLIFY_SECRET_ACCESS_KEY || '',
  },
});

// S3 bucket for backup files
const BACKUP_BUCKET = 'water-tap-asset-management-1750893967';

// Table configurations with complete column definitions (excluding internal IDs)
const TABLES = [
  { 
    name: 'water-tap-assets', 
    displayName: 'Assets',
    columns: [
      'assetBarcode', 'status', 'assetType', 'primaryIdentifier', 'secondaryIdentifier',
      'wing', 'wingInShort', 'room', 'floor', 'floorInWords', 'roomNo', 'roomName',
      'filterNeeded', 'filtersOn', 'filterExpiryDate', 'filterInstalledOn', 'filterType',
      'needFlushing', 'notes', 'reasonForFilterChange', 'augmentedCare', 'lowUsageAsset',
      'created', 'createdBy', 'modified', 'modifiedBy'
    ]
  },
  { 
    name: 'AssetAuditLogs', 
    displayName: 'Audit Logs',
    columns: [
      'assetId', 'timestamp', 'user', 'action', 'details', 'createdAt', 'updatedAt'
    ]
  },
  { 
    name: 'AssetTypes', 
    displayName: 'Asset Types',
    columns: [
      'label', 'createdBy', 'createdAt', 'updatedAt'
    ]
  },
  { 
    name: 'LPItems', 
    displayName: 'LP Items',
    columns: [
      'woNumber', 'createdDate', 'room', 'wardDept', 'location', 'wing',
      'assetBarcode', 'positiveCountPre', 'positiveCountPost', 'sampleNumber', 'labName',
      'certificateNumber', 'sampleType', 'testType', 'sampleTemperature', 'bacteriaVariant',
      'sampledOn', 'nextResampleDate', 'hotTemperature', 'coldTemperature', 'remedialWoNumber',
      'remedialCompletedDate', 'status', 'createdAt', 'updatedAt', 'createdBy', 'modifiedBy'
    ]
  },
  { 
    name: 'FilterTypes', 
    displayName: 'Filter Types',
    columns: [
      'name', 'description', 'createdAt', 'updatedAt', 'createdBy', 'modifiedBy'
    ]
  },
  { 
    name: 'SPListItems', 
    displayName: 'Filter Changed Items',
    columns: [
      'Location', 'FilterInstalledDate', 'FilterType', 'AssetBarcode', 'ReasonForFilterChange',
      'status', 'updatedAt', 'modifiedBy', 'reconciliationStatus', 'reconciliationTimestamp', 'reconciledBy'
    ]
  }
];

export interface BackupResult {
  success: boolean;
  message: string;
  filesGenerated: string[];
  emailSent?: boolean;
  error?: string;
}

export class BackupService {
  /**
   * Upload file to S3 and return presigned download URL
   */
  private static async uploadToS3(fileName: string, buffer: Buffer): Promise<string> {
    const key = `backups/${fileName}`;
    
    const putCommand = new PutObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ContentDisposition: `attachment; filename="${fileName}"`,
    });

    await s3Client.send(putCommand);
    
    // Generate presigned URL for download (valid for 7 days)
    const getCommand = new GetObjectCommand({
      Bucket: BACKUP_BUCKET,
      Key: key,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); // 7 days
    return presignedUrl;
  }

  /**
   * Export all DynamoDB tables to individual Excel files and send via email
   */
  static async createBackup(emailAddress: string): Promise<BackupResult> {
    try {
      console.log('Starting backup process...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = `backup-${timestamp}`;
      const filesGenerated: string[] = [];
      const excelBuffers: { fileName: string; buffer: Buffer }[] = [];
      
      // Export each table to individual Excel files
      for (const table of TABLES) {
        try {
          console.log(`Exporting table: ${table.name}`);
          const data = await this.exportTable(table.name);
          
          // Create individual workbook for this table
          const workbook = XLSX.utils.book_new();
          
          if (data.length > 0) {
            // Ensure all columns are present in the data
            const normalizedData = this.normalizeDataWithAllColumns(data, table.columns);
            
            // Create worksheet
            const worksheet = XLSX.utils.json_to_sheet(normalizedData);
            
            // Auto-size columns
            const colWidths = this.calculateColumnWidths(normalizedData);
            worksheet['!cols'] = colWidths;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
            
            console.log(`Exported ${data.length} records from ${table.name} with ${table.columns.length} columns`);
          } else {
            console.log(`No data found in table: ${table.name}`);
            // Create empty sheet with all column headers
            const emptyData = [{}];
            table.columns.forEach(column => {
              emptyData[0][column] = '';
            });
            const emptyWorksheet = XLSX.utils.json_to_sheet(emptyData);
            XLSX.utils.book_append_sheet(workbook, emptyWorksheet, 'Data');
          }
          
          // Add summary sheet for this table
          const tableSummary = [
            { Field: 'Table Name', Value: table.name },
            { Field: 'Display Name', Value: table.displayName },
            { Field: 'Export Date', Value: new Date().toISOString() },
            { Field: 'Record Count', Value: data.length },
            { Field: 'Environment', Value: process.env.NODE_ENV || 'production' },
            { Field: 'AWS Region', Value: process.env.AMPLIFY_AWS_REGION || 'eu-west-2' }
          ];
          
          const summaryWorksheet = XLSX.utils.json_to_sheet(tableSummary);
          XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
          
          // Generate Excel file for this table
          const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
          const fileName = `${table.displayName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;
          
          // Upload to S3 and get download URL
          const downloadUrl = await this.uploadToS3(fileName, excelBuffer);
          
          filesGenerated.push(fileName);
          excelBuffers.push({ fileName, buffer: excelBuffer, url: downloadUrl });
          
        } catch (error) {
          console.error(`Error exporting table ${table.name}:`, error);
          
          // Create error file for this table
          const errorWorkbook = XLSX.utils.book_new();
          const errorWorksheet = XLSX.utils.json_to_sheet([{ 
            error: `Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`,
            table: table.name,
            timestamp: new Date().toISOString()
          }]);
          XLSX.utils.book_append_sheet(errorWorkbook, errorWorksheet, 'Error');
          
          const errorBuffer = XLSX.write(errorWorkbook, { type: 'buffer', bookType: 'xlsx' });
          const errorFileName = `${table.displayName.replace(/[^a-zA-Z0-9]/g, '_')}_ERROR_${timestamp}.xlsx`;
          
          // Upload error file to S3
          const errorDownloadUrl = await this.uploadToS3(errorFileName, errorBuffer);
          
          filesGenerated.push(errorFileName);
          excelBuffers.push({ fileName: errorFileName, buffer: errorBuffer, url: errorDownloadUrl });
        }
      }
      
      // Send email with download links
      const emailSent = await this.sendBackupEmailWithDownloadLinks(emailAddress, excelBuffers, timestamp);
      
      console.log('Backup process completed successfully');
      
      return {
        success: true,
        message: `Backup completed successfully. ${filesGenerated.length} individual Excel files generated and sent to ${emailAddress}`,
        filesGenerated,
        emailSent
      };
      
    } catch (error) {
      console.error('Backup process failed:', error);
      return {
        success: false,
        message: 'Backup process failed',
        filesGenerated: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Export data from a specific DynamoDB table
   */
  private static async exportTable(tableName: string): Promise<any[]> {
    try {
      const allItems: any[] = [];
      let lastEvaluatedKey: any = undefined;
      
      do {
        const command = new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 100 // Process in batches
        });
        
        const result = await dynamodb.send(command);
        
        if (result.Items && result.Items.length > 0) {
          allItems.push(...result.Items);
        }
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        
      } while (lastEvaluatedKey);
      
      return allItems;
    } catch (error) {
      console.error(`Error scanning table ${tableName}:`, error);
      // If table doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('ResourceNotFoundException')) {
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Format date to dd/mm/yyyy format
   */
  private static formatDate(dateValue: any): string {
    if (!dateValue) return '';
    
    try {
      let date: Date;
      
      // Handle different date formats
      if (typeof dateValue === 'string') {
        // Handle ISO format (2024-01-15T10:30:00.000Z)
        if (dateValue.includes('T')) {
          date = new Date(dateValue);
        }
        // Handle DD/MM/YYYY format
        else if (dateValue.includes('/')) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        // Handle YYYY-MM-DD format
        else if (dateValue.includes('-') && dateValue.length === 10) {
          date = new Date(dateValue);
        }
        // Try parsing as is
        else {
          date = new Date(dateValue);
        }
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        return String(dateValue);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return String(dateValue);
      }
      
      // Format as dd/mm/yyyy
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      return String(dateValue);
    }
  }

  /**
   * Check if a column contains date values
   */
  private static isDateColumn(columnName: string): boolean {
    const dateColumns = [
      'createdDate', 'sampledOn', 'nextResampleDate', 'remedialCompletedDate',
      'createdAt', 'updatedAt', 'timestamp', 'filterExpiryDate', 'filterInstalledDate',
      'FilterInstalledDate', 'filterInstalledOn', 'created', 'modified', 'reconciliationTimestamp'
    ];
    return dateColumns.includes(columnName);
  }

  /**
   * Check if a column contains boolean values
   */
  private static isBooleanColumn(columnName: string): boolean {
    const booleanColumns = [
      'filterNeeded', 'filtersOn', 'needFlushing', 'augmentedCare', 'lowUsageAsset'
    ];
    return booleanColumns.includes(columnName);
  }

  /**
   * Standardize boolean values to YES/NO format
   */
  private static standardizeBoolean(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    const stringValue = String(value).toLowerCase().trim();
    
    // Handle various boolean representations
    if (stringValue === 'true' || stringValue === 'yes' || stringValue === '1') {
      return 'YES';
    } else if (stringValue === 'false' || stringValue === 'no' || stringValue === '0') {
      return 'NO';
    }
    
    // Return original value if not a recognized boolean
    return String(value);
  }

  /**
   * Normalize data to ensure all columns are present and format dates/booleans
   */
  private static normalizeDataWithAllColumns(data: any[], allColumns: string[]): any[] {
    return data.map(item => {
      const normalizedItem: any = {};
      
      // Add all columns, using empty string for missing values and formatting dates/booleans
      allColumns.forEach(column => {
        const value = item[column];
        if (value !== undefined) {
          // Format dates to dd/mm/yyyy
          if (this.isDateColumn(column)) {
            normalizedItem[column] = this.formatDate(value);
          }
          // Standardize boolean values to YES/NO
          else if (this.isBooleanColumn(column)) {
            normalizedItem[column] = this.standardizeBoolean(value);
          } else {
            normalizedItem[column] = value;
          }
        } else {
          normalizedItem[column] = '';
        }
      });
      
      return normalizedItem;
    });
  }

  /**
   * Calculate optimal column widths for Excel
   */
  private static calculateColumnWidths(data: any[]): any[] {
    if (data.length === 0) return [];
    
    const columns = Object.keys(data[0]);
    const widths: any[] = [];
    
    columns.forEach(column => {
      let maxLength = column.length; // Start with header length
      
      data.forEach(row => {
        const value = row[column];
        if (value !== null && value !== undefined) {
          const stringValue = String(value);
          maxLength = Math.max(maxLength, stringValue.length);
        }
      });
      
      // Set reasonable limits
      widths.push({ wch: Math.min(Math.max(maxLength, 10), 50) });
    });
    
    return widths;
  }
  
  /**
   * Create summary sheet with backup information
   */
  private static async createSummarySheet(): Promise<any[]> {
    const timestamp = new Date().toISOString();
    const summary = [
      { Field: 'Backup Date', Value: timestamp },
      { Field: 'Backup Type', Value: 'Full Database Export' },
      { Field: 'Tables Exported', Value: TABLES.length },
      { Field: 'Environment', Value: process.env.NODE_ENV || 'production' },
      { Field: 'AWS Region', Value: process.env.AMPLIFY_AWS_REGION || 'eu-west-2' }
    ];
    
    // Add table-specific counts
    for (const table of TABLES) {
      try {
        const data = await this.exportTable(table.name);
        summary.push({ 
          Field: `${table.displayName} Records`, 
          Value: data.length 
        });
      } catch (error) {
        summary.push({ 
          Field: `${table.displayName} Records`, 
          Value: 'Error retrieving count' 
        });
      }
    }
    
    return summary;
  }
  
  /**
   * Send backup email with multiple Excel file attachments
   */
  private static async sendBackupEmailWithDownloadLinks(
    emailAddress: string, 
    excelBuffers: { fileName: string; buffer: Buffer; url: string }[],
    timestamp: string
  ): Promise<boolean> {
    try {
      const timestampFormatted = new Date().toLocaleString();
      
      // Create file list with download links
      const fileList = excelBuffers.map(file => 
        `<li><a href="${file.url}" style="color: #007bff; text-decoration: none;">${file.fileName}</a></li>`
      ).join('');
      
      const command = new SendEmailCommand({
        Source: process.env.SES_FROM_EMAIL || 'noreply@water.facilities-stg.co.uk',
        Destination: {
          ToAddresses: [emailAddress]
        },
        Message: {
          Subject: {
            Data: `LP Management Database Backup - ${timestampFormatted}`,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: `
                <html>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">LP Management Database Backup</h2>
                      <p>Your database backup has been generated successfully and is ready for download.</p>
                      <p><strong>Backup Date:</strong> ${timestampFormatted}</p>
                      <p><strong>Files Generated:</strong> ${excelBuffers.length} individual Excel files</p>
                      
                      <h3 style="color: #2c3e50; margin-top: 30px;">Download Your Backup Files:</h3>
                      <ul style="list-style: none; padding: 0;">
                        ${fileList}
                      </ul>
                      
                      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h4 style="color: #2c3e50; margin-top: 0;">Backup Contents:</h4>
                        <ul>
                          ${excelBuffers.map(file => {
                            // Extract the display name from the filename (remove timestamp and extension)
                            const displayName = file.fileName.replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.xlsx$/, '');
                            return `<li><strong>${displayName}:</strong> Data exported successfully (✓)</li>`;
                          }).join('')}
                        </ul>
                      </div>
                      
                      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Important:</strong> These download links will expire after 7 days. Please download and save the files to a secure location.</p>
                      </div>
                      
                      <p style="margin-top: 30px;">Best regards,<br><strong>LP Management System</strong></p>
                    </div>
                  </body>
                </html>
              `,
              Charset: 'UTF-8'
            },
            Text: {
              Data: `
LP Management Database Backup

Your database backup has been generated successfully and is ready for download.

Backup Date: ${timestampFormatted}
Files Generated: ${excelBuffers.length} individual Excel files

Download Links:
${excelBuffers.map(f => `- ${f.fileName}: ${f.url}`).join('\n')}

This backup includes all data from your LP Management system.

IMPORTANT: These download links will expire after 7 days. Please download and save the files to a secure location.

Best regards,
LP Management System
              `,
              Charset: 'UTF-8'
            }
          }
        }
      });
      
      // Note: For production with actual file attachments, you would need to:
      // 1. Upload files to S3 first
      // 2. Use SES with S3 attachments
      // 3. Or use a different approach for large files
      // For now, this sends a notification email about the backup completion
      
      await sesClient.send(command);
      console.log(`Backup email sent successfully to ${emailAddress} with ${excelBuffers.length} download links`);
      return true;
      
    } catch (error) {
      console.error('Error sending backup email:', error);
      return false;
    }
  }
  
  /**
   * Get backup status and table information
   */
  static async getBackupStatus(): Promise<any> {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        tables: [] as any[]
      };
      
      for (const table of TABLES) {
        try {
          const data = await this.exportTable(table.name);
          status.tables.push({
            name: table.name,
            displayName: table.displayName,
            recordCount: data.length,
            status: 'accessible'
          });
        } catch (error) {
          status.tables.push({
            name: table.name,
            displayName: table.displayName,
            recordCount: 0,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return status;
    } catch (error) {
      console.error('Error getting backup status:', error);
      throw error;
    }
  }

  /**
   * Send selective backup with specified databases
   */
  public static async sendSelectiveBackup(
    emailAddress: string,
    selectedDatabases: string[],
    reportName?: string
  ): Promise<boolean> {
    try {
      console.log(`Starting selective backup for ${emailAddress} with databases: ${selectedDatabases.join(', ')}`);
      
      // Filter tables based on selected databases
      const selectedTables = TABLES.filter(table => selectedDatabases.includes(table.name));
      
      if (selectedTables.length === 0) {
        throw new Error('No valid databases selected');
      }

      const excelBuffers: { fileName: string; buffer: Buffer; url: string }[] = [];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Export each selected table
      for (const table of selectedTables) {
        try {
          console.log(`Exporting table: ${table.name}`);
          const data = await this.exportTable(table.name);
          
          if (data && data.length > 0) {
            // Normalize data to ensure all columns are present
            const normalizedData = this.normalizeDataWithAllColumns(data, table.columns);
            
            // Create workbook with data and summary sheets
            const workbook = XLSX.utils.book_new();
            
            // Add data worksheet
            const worksheet = XLSX.utils.json_to_sheet(normalizedData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
            
            // Add summary worksheet
            const summaryData = [
              { Metric: 'Total Records', Value: data.length },
              { Metric: 'Export Date', Value: new Date().toLocaleString() },
              { Metric: 'Report Name', Value: reportName || 'Selective Backup' },
              { Metric: 'Selected Databases', Value: selectedDatabases.join(', ') }
            ];
            const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
            
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            const fileName = `${table.displayName}_${timestamp}.xlsx`;
            
            // Upload to S3 and get signed URL
            const s3Key = `backups/${timestamp}/${fileName}`;
            await s3Client.send(new PutObjectCommand({
              Bucket: BACKUP_BUCKET,
              Key: s3Key,
              Body: buffer,
              ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }));

            const url = await getSignedUrl(s3Client, new GetObjectCommand({
              Bucket: BACKUP_BUCKET,
              Key: s3Key,
            }), { expiresIn: 7 * 24 * 60 * 60 }); // 7 days

            excelBuffers.push({ fileName, buffer, url });
            
            console.log(`Exported ${data.length} records from ${table.name} with ${table.columns.length} columns`);
          } else {
            console.log(`No data found for table: ${table.name}`);
          }
        } catch (error) {
          console.error(`Error exporting table ${table.name}:`, error);
          // Continue with other tables even if one fails
        }
      }

      if (excelBuffers.length === 0) {
        throw new Error('No data was exported from any selected database');
      }

      // Send email with the generated files
      return await this.sendBackupEmailWithDownloadLinks(emailAddress, excelBuffers, timestamp);
    } catch (error) {
      console.error('Error in selective backup:', error);
      return false;
    }
  }
}
