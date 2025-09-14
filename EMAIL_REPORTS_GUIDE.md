# Email Reports System - User Guide

## Overview

The Email Reports system allows you to create automated, scheduled email reports with custom database selections, frequency settings, and recipient lists. This replaces the manual backup system with a comprehensive reporting solution.

## Features

### ✅ **Completed Features**

1. **📧 Email Reports Tab**: Renamed from "Backup" to "Email Reports" with new icon
2. **🎯 Selective Database Export**: Choose which databases to include in reports
3. **⏰ Flexible Scheduling**: Daily, weekly, or monthly report frequency
4. **👥 Multiple Recipients**: Send reports to multiple email addresses
5. **📊 Professional Excel Format**: All dates in `dd/mm/yyyy`, boolean fields as YES/NO
6. **🗄️ Database Storage**: Scheduled reports stored in DynamoDB
7. **🔧 Management Interface**: Create, edit, activate/deactivate, and delete reports
8. **🧪 Test Reports**: Send test reports to verify configuration
9. **⚡ Background Scheduler**: Automated execution of scheduled reports

## How to Use

### 1. **Access Email Reports**
- Navigate to the **"Email Reports"** tab in the main navigation
- The interface has two sections: **"Create Report"** and **"Manage Reports"**

### 2. **Create a New Scheduled Report**

#### **Report Configuration**
- **Report Name**: Give your report a descriptive name
- **Select Databases**: Choose from available databases:
  - ✅ **Assets** - All water tap assets and their details
  - ✅ **Audit Logs** - Asset audit and maintenance logs  
  - ✅ **Asset Types** - Asset type definitions and configurations
  - ✅ **LP Items** - Legionella prevention items and test results
  - ✅ **Filter Types** - Filter type definitions and specifications
  - ✅ **SP List Items** - Specialist list items and reconciliation data

#### **Schedule Configuration**
- **Frequency**: Choose from:
  - 📅 **Daily** - Every day at 9:00 AM
  - 📅 **Weekly** - Every week on the same day at 9:00 AM
  - 📅 **Monthly** - Every month on the same date at 9:00 AM
- **Start Date**: Select when the first report should be sent

#### **Recipients**
- **Add Recipients**: Enter email addresses one by one
- **Multiple Recipients**: Add as many recipients as needed
- **Remove Recipients**: Click the trash icon to remove recipients

### 3. **Manage Existing Reports**

#### **Report List**
- View all created reports with their status
- See next run time and last run information
- Check recipient count and database selections

#### **Report Actions**
- **🧪 Test**: Send a test report immediately
- **⏸️ Deactivate/▶️ Activate**: Enable or disable reports
- **🗑️ Delete**: Remove reports permanently

## Technical Implementation

### **Database Structure**
- **Table**: `ScheduledReports`
- **Key Fields**:
  - `id`: Unique identifier
  - `name`: Report name
  - `databases`: Array of selected database names
  - `frequency`: daily/weekly/monthly
  - `startDate`: When to start sending reports
  - `recipients`: Array of email addresses
  - `isActive`: Whether the report is enabled
  - `lastRun`: Timestamp of last execution
  - `nextRun`: Timestamp of next scheduled execution

### **API Endpoints**

#### **Scheduled Reports Management**
- `GET /api/scheduled-reports` - List all reports
- `POST /api/scheduled-reports` - Create new report
- `GET /api/scheduled-reports/[id]` - Get specific report
- `PATCH /api/scheduled-reports/[id]` - Update report
- `DELETE /api/scheduled-reports/[id]` - Delete report
- `POST /api/scheduled-reports/[id]/test` - Send test report

#### **Scheduler Service**
- `GET /api/scheduler` - Get scheduler status
- `POST /api/scheduler` - Execute scheduled reports (cron job)

#### **Setup**
- `POST /api/setup-scheduler` - Create ScheduledReports table
- `GET /api/setup-scheduler` - Check if table exists

### **Automated Execution**

#### **Cron Job Setup**
The system includes a cron job script (`cron-scheduler.js`) that should be set up to run every hour:

```bash
# Make the script executable
chmod +x cron-scheduler.js

# Add to crontab (runs every hour)
0 * * * * /path/to/cron-scheduler.js
```

#### **Alternative Scheduling Options**
- **AWS EventBridge**: Set up CloudWatch Events
- **Google Cloud Scheduler**: For GCP deployments
- **Azure Logic Apps**: For Azure deployments
- **Manual Trigger**: Call `/api/scheduler` endpoint manually

## Email Format

### **Professional Excel Files**
- **Date Format**: All dates in `dd/mm/yyyy` format
- **Boolean Fields**: Standardized to "YES" or "NO"
- **Complete Columns**: All expected columns included
- **No Internal IDs**: Clean data without system identifiers
- **Summary Sheet**: Each file includes metadata and statistics

### **Email Content**
- **Subject**: "LP Management Database Report - [Report Name] - [Date]"
- **Professional HTML**: Clean, branded email template
- **Download Links**: Secure S3 URLs with 7-day expiration
- **File List**: Clear listing of all generated files

## Security & Best Practices

### **Email Security**
- **Domain Verification**: Emails sent from `noreply@water.facilities-stg.co.uk`
- **DKIM Signing**: Proper email authentication
- **Secure URLs**: S3 signed URLs with expiration

### **Data Protection**
- **Selective Export**: Only export requested databases
- **No Internal IDs**: Exclude system identifiers
- **Temporary Storage**: Files stored temporarily in S3
- **Access Control**: Reports only sent to specified recipients

## Troubleshooting

### **Common Issues**

#### **Report Not Sending**
1. Check if report is **Active**
2. Verify **recipients** are valid email addresses
3. Check **next run time** is in the past
4. Review server logs for errors

#### **Missing Data**
1. Ensure **databases are selected**
2. Check if databases contain data
3. Verify **column definitions** are correct

#### **Email Delivery Issues**
1. Check **SES domain verification**
2. Verify **DKIM setup**
3. Check **spam folders**
4. Review **SES sending limits**

### **Logs and Monitoring**
- **Server Logs**: Check application logs for execution details
- **SES Logs**: Monitor email delivery in AWS SES console
- **S3 Logs**: Check file upload/download logs

## Migration from Manual Backup

### **What Changed**
- ✅ **Tab Renamed**: "Backup" → "Email Reports"
- ✅ **New Interface**: Comprehensive scheduling interface
- ✅ **Selective Export**: Choose specific databases
- ✅ **Automated Execution**: No more manual triggering
- ✅ **Multiple Recipients**: Send to multiple people
- ✅ **Professional Format**: Consistent Excel formatting

### **Backward Compatibility**
- **Old Backup API**: Still available at `/api/backup`
- **Same Email Format**: Maintains professional Excel structure
- **Same S3 Storage**: Uses existing backup bucket
- **Same Email Domain**: Continues using verified domain

## Next Steps

### **Immediate Actions**
1. **Set up Cron Job**: Configure automated execution
2. **Create Reports**: Set up your first scheduled reports
3. **Test Reports**: Send test reports to verify setup
4. **Monitor Execution**: Check logs and email delivery

### **Future Enhancements**
- **Custom Time Slots**: Specify exact times for reports
- **Report Templates**: Save and reuse report configurations
- **Email Templates**: Customize email content
- **Report History**: Track execution history and statistics
- **Advanced Filtering**: Filter data within reports
- **Multiple Formats**: Support for PDF, CSV exports

## Support

For technical support or questions about the Email Reports system:
1. Check this documentation first
2. Review server logs for error details
3. Test with a simple report configuration
4. Verify email delivery in SES console

---

**🎉 Your automated email reporting system is now ready to use!**
