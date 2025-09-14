const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  ScanCommand 
} = require('@aws-sdk/lib-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const XLSX = require('xlsx');

// Configure AWS SDK v3
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-west-2'
});

const dynamodb = DynamoDBDocumentClient.from(client);
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'eu-west-2'
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-2'
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
    displayName: 'SP List Items',
    columns: [
      'Location', 'FilterInstalledDate', 'FilterType', 'AssetBarcode', 'ReasonForFilterChange',
      'status', 'updatedAt', 'modifiedBy', 'reconciliationStatus', 'reconciliationTimestamp', 'reconciledBy'
    ]
  }
];

/**
 * Upload file to S3 and return download URL
 */
async function uploadToS3(fileName, buffer) {
  const key = `backups/${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: BACKUP_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ContentDisposition: `attachment; filename="${fileName}"`,
  });

  await s3Client.send(command);
  
  // Return S3 URL (public read access)
  return `https://${BACKUP_BUCKET}.s3.${process.env.AWS_REGION || 'eu-west-2'}.amazonaws.com/${key}`;
}

/**
 * Export data from a specific DynamoDB table
 */
async function exportTable(tableName) {
  try {
    const allItems = [];
    let lastEvaluatedKey = undefined;
    
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
    if (error.message && error.message.includes('ResourceNotFoundException')) {
      return [];
    }
    throw error;
  }
}

/**
 * Format date to dd/mm/yyyy format
 */
function formatDate(dateValue) {
  if (!dateValue) return '';
  
  try {
    let date;
    
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
function isDateColumn(columnName) {
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
function isBooleanColumn(columnName) {
  const booleanColumns = [
    'filterNeeded', 'filtersOn', 'needFlushing', 'augmentedCare', 'lowUsageAsset'
  ];
  return booleanColumns.includes(columnName);
}

/**
 * Standardize boolean values to YES/NO format
 */
function standardizeBoolean(value) {
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
function normalizeDataWithAllColumns(data, allColumns) {
  return data.map(item => {
    const normalizedItem = {};
    
    // Add all columns, using empty string for missing values and formatting dates/booleans
    allColumns.forEach(column => {
      const value = item[column];
      if (value !== undefined) {
        // Format dates to dd/mm/yyyy
        if (isDateColumn(column)) {
          normalizedItem[column] = formatDate(value);
        }
        // Standardize boolean values to YES/NO
        else if (isBooleanColumn(column)) {
          normalizedItem[column] = standardizeBoolean(value);
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
function calculateColumnWidths(data) {
  if (data.length === 0) return [];
  
  const columns = Object.keys(data[0]);
  const widths = [];
  
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
async function createSummarySheet() {
  const timestamp = new Date().toISOString();
  const summary = [
    { Field: 'Backup Date', Value: timestamp },
    { Field: 'Backup Type', Value: 'Scheduled Full Database Export' },
    { Field: 'Tables Exported', Value: TABLES.length },
    { Field: 'Environment', Value: process.env.NODE_ENV || 'production' },
    { Field: 'AWS Region', Value: process.env.AWS_REGION || 'eu-west-2' }
  ];
  
  // Add table-specific counts
  for (const table of TABLES) {
    try {
      const data = await exportTable(table.name);
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
async function sendBackupEmailWithMultipleFiles(emailAddress, excelBuffers, timestamp) {
  try {
    const timestampFormatted = new Date().toLocaleString();
    
    // Create file list for email
    const fileList = excelBuffers.map(file => `<li>${file.fileName}</li>`).join('');
    
    const command = new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL || 'noreply@water.facilities-stg.co.uk',
      Destination: {
        ToAddresses: [emailAddress]
      },
      Message: {
        Subject: {
          Data: `LP Management Scheduled Backup - ${timestampFormatted}`,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: `
              <html>
                <body>
                  <h2>LP Management Scheduled Database Backup</h2>
                  <p>Your scheduled database backup has been generated successfully.</p>
                  <p><strong>Backup Date:</strong> ${timestampFormatted}</p>
                  <p><strong>Files Generated:</strong> ${excelBuffers.length} individual Excel files</p>
                  <p>Each file contains data from a specific table:</p>
                  <ul>
                    ${fileList}
                  </ul>
                  <p>This backup includes all data from your LP Management system:</p>
                  <ul>
                    <li><strong>Assets:</strong> Main asset data (${excelBuffers.find(f => f.fileName.includes('Assets')) ? '✓' : '✗'})</li>
                    <li><strong>Audit Logs:</strong> System audit trail (${excelBuffers.find(f => f.fileName.includes('Audit_Logs')) ? '✓' : '✗'})</li>
                    <li><strong>Asset Types:</strong> Asset type definitions (${excelBuffers.find(f => f.fileName.includes('Asset_Types')) ? '✓' : '✗'})</li>
                    <li><strong>LP Items:</strong> LP management data (${excelBuffers.find(f => f.fileName.includes('LP_Items')) ? '✓' : '✗'})</li>
                    <li><strong>Filter Types:</strong> Filter type definitions (${excelBuffers.find(f => f.fileName.includes('Filter_Types')) ? '✓' : '✗'})</li>
                    <li><strong>SP List Items:</strong> Filter reconciliation data (${excelBuffers.find(f => f.fileName.includes('SP_List_Items')) ? '✓' : '✗'})</li>
                  </ul>
                  <p>Please keep these backup files in a secure location.</p>
                  <hr>
                  <p><em>This is an automated scheduled backup from the LP Management system.</em></p>
                </body>
              </html>
            `,
            Charset: 'UTF-8'
          },
          Text: {
            Data: `
LP Management Scheduled Database Backup

Your scheduled database backup has been generated successfully.

Backup Date: ${timestampFormatted}
Files Generated: ${excelBuffers.length} individual Excel files

Files:
${excelBuffers.map(f => `- ${f.fileName}`).join('\n')}

This backup includes all data from your LP Management system.

Please keep these backup files in a secure location.

This is an automated scheduled backup from the LP Management system.
            `,
            Charset: 'UTF-8'
          }
        }
      }
    });
    
    await sesClient.send(command);
    console.log(`Scheduled backup email sent successfully to ${emailAddress} with ${excelBuffers.length} file notifications`);
    return true;
    
  } catch (error) {
    console.error('Error sending scheduled backup email:', error);
    return false;
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  try {
    console.log('Starting scheduled backup process...');
    
    const emailAddress = process.env.BACKUP_EMAIL || event.emailAddress;
    
    if (!emailAddress) {
      throw new Error('No email address provided for backup');
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `scheduled-backup-${timestamp}`;
    const filesGenerated = [];
    const excelBuffers = [];
    
    // Export each table to individual Excel files
    for (const table of TABLES) {
      try {
        console.log(`Exporting table: ${table.name}`);
        const data = await exportTable(table.name);
        
        // Create individual workbook for this table
        const workbook = XLSX.utils.book_new();
        
        if (data.length > 0) {
          // Ensure all columns are present in the data
          const normalizedData = normalizeDataWithAllColumns(data, table.columns);
          
          // Create worksheet
          const worksheet = XLSX.utils.json_to_sheet(normalizedData);
          
          // Auto-size columns
          const colWidths = calculateColumnWidths(normalizedData);
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
          { Field: 'AWS Region', Value: process.env.AWS_REGION || 'eu-west-2' }
        ];
        
        const summaryWorksheet = XLSX.utils.json_to_sheet(tableSummary);
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
        
        // Generate Excel file for this table
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `${table.displayName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.xlsx`;
        
        filesGenerated.push(fileName);
        excelBuffers.push({ fileName, buffer: excelBuffer });
        
      } catch (error) {
        console.error(`Error exporting table ${table.name}:`, error);
        
        // Create error file for this table
        const errorWorkbook = XLSX.utils.book_new();
        const errorWorksheet = XLSX.utils.json_to_sheet([{ 
          error: `Failed to export: ${error.message || 'Unknown error'}`,
          table: table.name,
          timestamp: new Date().toISOString()
        }]);
        XLSX.utils.book_append_sheet(errorWorkbook, errorWorksheet, 'Error');
        
        const errorBuffer = XLSX.write(errorWorkbook, { type: 'buffer', bookType: 'xlsx' });
        const errorFileName = `${table.displayName.replace(/[^a-zA-Z0-9]/g, '_')}_ERROR_${timestamp}.xlsx`;
        
        filesGenerated.push(errorFileName);
        excelBuffers.push({ fileName: errorFileName, buffer: errorBuffer });
      }
    }
    
    // Send email with all attachments
    const emailSent = await sendBackupEmailWithMultipleFiles(emailAddress, excelBuffers, timestamp);
    
    console.log('Scheduled backup process completed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Scheduled backup completed successfully. ${filesGenerated.length} individual Excel files generated and sent to ${emailAddress}`,
        filesGenerated,
        emailSent,
        backupId
      })
    };
    
  } catch (error) {
    console.error('Scheduled backup process failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Scheduled backup process failed',
        error: error.message || 'Unknown error'
      })
    };
  }
};
