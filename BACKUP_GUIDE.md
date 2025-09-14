# LP Management - Database Backup System

## 📋 Overview

The LP Management system includes a comprehensive backup mechanism that exports all DynamoDB data to Excel files and sends them via AWS SES email. This ensures your data is safely backed up and easily accessible.

## 🏗️ Backup System Architecture

### **Components**
1. **BackupService** (`src/lib/backup.ts`) - Core backup logic
2. **Backup API** (`src/app/api/backup/route.ts`) - REST API endpoints
3. **BackupManager UI** (`src/components/BackupManager.tsx`) - User interface
4. **AWS SES Integration** - Email delivery system

### **Tables Backed Up**
- `water-tap-assets` - Main assets data
- `AssetAuditLogs` - Audit trail logs
- `AssetTypes` - Asset type definitions
- `LPItems` - LP items data
- `FilterTypes` - Filter type definitions
- `SPListItems` - SP list items data

## 🚀 Features

### **Excel Export**
- Individual Excel files for each DynamoDB table
- Each file contains a "Data" sheet and a "Summary" sheet
- Auto-sized columns for optimal readability
- Error handling for inaccessible tables
- Clean file naming with timestamps

### **Email Delivery**
- Automated email delivery via AWS SES
- Professional HTML email template
- Notification email with file list and status
- Detailed backup information for each table

### **Status Monitoring**
- Real-time table accessibility status
- Record count for each table
- Error reporting for failed exports
- Backup history tracking

## 🔧 Setup Instructions

### **1. AWS SES Configuration**

#### **Step 1: Verify Email Addresses**
```bash
# Verify sender email (required for SES sandbox)
aws ses verify-email-identity --email-address noreply@yourdomain.com --region eu-west-2

# Verify recipient email (if in sandbox mode)
aws ses verify-email-identity --email-address admin@yourdomain.com --region eu-west-2
```

#### **Step 2: Request Production Access (Optional)**
If you need to send emails to unverified addresses, request production access in the AWS SES console.

#### **Step 3: Set Environment Variables**
Add to your Amplify environment variables:
```env
SES_FROM_EMAIL=noreply@yourdomain.com
AMPLIFY_AWS_REGION=eu-west-2
AMPLIFY_ACCESS_KEY_ID=your-access-key
AMPLIFY_SECRET_ACCESS_KEY=your-secret-key
```

### **2. IAM Permissions**

Ensure your AWS credentials have the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:DescribeTable"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:*:table/water-tap-assets",
        "arn:aws:dynamodb:eu-west-2:*:table/AssetAuditLogs",
        "arn:aws:dynamodb:eu-west-2:*:table/AssetTypes",
        "arn:aws:dynamodb:eu-west-2:*:table/LPItems",
        "arn:aws:dynamodb:eu-west-2:*:table/FilterTypes",
        "arn:aws:dynamodb:eu-west-2:*:table/SPListItems"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📱 Usage

### **Via Web Interface**
1. Navigate to the **Backup** tab in the main application
2. Enter the email address where you want to receive the backup
3. Click **Create Backup**
4. Monitor the progress and check your email for the backup file

### **Via API**

#### **Create Backup**
```bash
curl -X POST https://your-app-url/api/backup \
  -H "Content-Type: application/json" \
  -d '{"emailAddress": "admin@yourdomain.com"}'
```

#### **Check Backup Status**
```bash
curl https://your-app-url/api/backup
```

## 📊 Backup File Structure

### **Individual Excel Files**
Each DynamoDB table is exported to its own Excel file:

- **Assets_[timestamp].xlsx** - Complete asset data with all fields
- **Audit_Logs_[timestamp].xlsx** - All audit trail entries
- **Asset_Types_[timestamp].xlsx** - Asset type definitions
- **LP_Items_[timestamp].xlsx** - LP items data
- **Filter_Types_[timestamp].xlsx** - Filter type definitions
- **SP_List_Items_[timestamp].xlsx** - SP list items data (Filter Reconciliation)

### **Each File Contains**
- **Data Sheet** - All records from the specific table
- **Summary Sheet** - Table metadata including:
  - Table Name
  - Display Name
  - Export Date
  - Record Count
  - Environment
  - AWS Region

## 🔄 Automation Options

### **1. Scheduled Backups (Lambda + EventBridge)**

Create a Lambda function for scheduled backups:

```javascript
// lambda-scheduled-backup.js
const { BackupService } = require('./backup-service');

exports.handler = async (event) => {
  try {
    const result = await BackupService.createBackup('admin@yourdomain.com');
    console.log('Scheduled backup completed:', result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error('Scheduled backup failed:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```

### **2. EventBridge Rule**
```bash
# Create daily backup at 2 AM UTC
aws events put-rule \
  --name "daily-backup" \
  --schedule-expression "cron(0 2 * * ? *)" \
  --region eu-west-2
```

### **3. GitHub Actions (Alternative)**
```yaml
# .github/workflows/backup.yml
name: Daily Backup
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Backup
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/backup \
            -H "Content-Type: application/json" \
            -d '{"emailAddress": "${{ secrets.BACKUP_EMAIL }}"}'
```

## 🛠️ Troubleshooting

### **Common Issues**

#### **1. SES Email Not Sending**
- **Cause**: Email address not verified or SES in sandbox mode
- **Solution**: Verify email addresses in AWS SES console

#### **2. DynamoDB Access Denied**
- **Cause**: Insufficient IAM permissions
- **Solution**: Update IAM policy with required DynamoDB permissions

#### **3. Large Backup Files**
- **Cause**: Too much data for email attachment
- **Solution**: Consider uploading to S3 and sending download link

#### **4. Backup Timeout**
- **Cause**: Large datasets taking too long to export
- **Solution**: Implement pagination or async processing

### **Error Codes**
- `400` - Invalid email address format
- `500` - Internal server error during backup
- `503` - SES service unavailable

## 📈 Performance Considerations

### **Optimization Tips**
1. **Batch Processing**: Large tables are processed in batches of 100 records
2. **Memory Management**: Data is streamed to avoid memory issues
3. **Error Handling**: Individual table failures don't stop the entire backup
4. **Progress Tracking**: Real-time status updates for long-running backups

### **Recommended Backup Frequency**
- **Daily**: For production systems with frequent changes
- **Weekly**: For development or low-change environments
- **Before Major Updates**: Always backup before system changes

## 🔒 Security Considerations

### **Data Protection**
- Backup files contain sensitive asset information
- Store backup files securely
- Consider encryption for backup storage
- Implement access controls for backup files

### **Email Security**
- Use verified email addresses only
- Consider using encrypted email for sensitive backups
- Implement backup file retention policies

## 📞 Support

For backup-related issues:
1. Check the backup status in the web interface
2. Review AWS CloudWatch logs for detailed error information
3. Verify AWS SES and DynamoDB permissions
4. Contact system administrator for assistance

## 🔄 Future Enhancements

### **Planned Features**
- [ ] S3 backup storage option
- [ ] Backup file encryption
- [ ] Automated backup scheduling UI
- [ ] Backup file compression
- [ ] Incremental backup support
- [ ] Backup restoration functionality

### **Integration Options**
- [ ] Slack notifications for backup status
- [ ] Microsoft Teams integration
- [ ] Custom webhook notifications
- [ ] Backup file versioning

---

**Note**: This backup system is designed for data protection and disaster recovery. Regular testing of backup files is recommended to ensure data integrity.
