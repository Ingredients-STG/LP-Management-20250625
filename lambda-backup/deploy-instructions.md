# Lambda Scheduled Backup Deployment Instructions

## 📋 Overview

This Lambda function provides automated scheduled backups for the LP Management system. It exports all DynamoDB data to Excel files and sends them via AWS SES email.

## 🚀 Deployment Steps

### **1. Package the Lambda Function**

```bash
# Navigate to the lambda-backup directory
cd lambda-backup

# Install dependencies
npm install

# Create deployment package
zip -r lambda-backup.zip . -x "*.md" "deploy-instructions.md"
```

### **2. Create Lambda Function**

```bash
# Create the Lambda function
aws lambda create-function \
  --function-name lp-management-scheduled-backup \
  --runtime nodejs18.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-backup-role \
  --handler index.handler \
  --zip-file fileb://lambda-backup.zip \
  --timeout 900 \
  --memory-size 512 \
  --region eu-west-2
```

### **3. Set Environment Variables**

```bash
# Set environment variables
aws lambda update-function-configuration \
  --function-name lp-management-scheduled-backup \
  --environment Variables='{
    "AWS_REGION": "eu-west-2",
    "SES_FROM_EMAIL": "noreply@yourdomain.com",
    "BACKUP_EMAIL": "admin@yourdomain.com",
    "NODE_ENV": "production"
  }' \
  --region eu-west-2
```

### **4. Create IAM Role**

Create an IAM role with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
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

### **5. Create EventBridge Rule for Scheduling**

```bash
# Create daily backup rule (2 AM UTC)
aws events put-rule \
  --name "lp-management-daily-backup" \
  --schedule-expression "cron(0 2 * * ? *)" \
  --description "Daily backup for LP Management system" \
  --region eu-west-2

# Add Lambda function as target
aws events put-targets \
  --rule "lp-management-daily-backup" \
  --targets "Id"="1","Arn"="arn:aws:lambda:eu-west-2:YOUR_ACCOUNT_ID:function:lp-management-scheduled-backup" \
  --region eu-west-2
```

### **6. Grant EventBridge Permission to Invoke Lambda**

```bash
aws lambda add-permission \
  --function-name lp-management-scheduled-backup \
  --statement-id "allow-eventbridge" \
  --action "lambda:InvokeFunction" \
  --principal "events.amazonaws.com" \
  --source-arn "arn:aws:events:eu-west-2:YOUR_ACCOUNT_ID:rule/lp-management-daily-backup" \
  --region eu-west-2
```

## 🔧 Configuration Options

### **Schedule Expressions**

#### **Daily at 2 AM UTC**
```bash
--schedule-expression "cron(0 2 * * ? *)"
```

#### **Weekly on Monday at 2 AM UTC**
```bash
--schedule-expression "cron(0 2 ? * MON *)"
```

#### **Monthly on 1st at 2 AM UTC**
```bash
--schedule-expression "cron(0 2 1 * ? *)"
```

### **Environment Variables**

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AWS_REGION` | AWS region | No | eu-west-2 |
| `SES_FROM_EMAIL` | Sender email address | Yes | - |
| `BACKUP_EMAIL` | Recipient email address | Yes | - |
| `NODE_ENV` | Environment | No | production |

## 🧪 Testing

### **Manual Test**

```bash
# Test the Lambda function manually
aws lambda invoke \
  --function-name lp-management-scheduled-backup \
  --payload '{"emailAddress": "test@yourdomain.com"}' \
  --region eu-west-2 \
  response.json

# Check the response
cat response.json
```

### **CloudWatch Logs**

```bash
# View recent logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/lp-management-scheduled-backup" --region eu-west-2

# Get log streams
aws logs describe-log-streams --log-group-name "/aws/lambda/lp-management-scheduled-backup" --region eu-west-2

# Get log events
aws logs get-log-events \
  --log-group-name "/aws/lambda/lp-management-scheduled-backup" \
  --log-stream-name "STREAM_NAME" \
  --region eu-west-2
```

## 📊 Monitoring

### **CloudWatch Metrics**
- Duration
- Errors
- Invocations
- Throttles

### **CloudWatch Alarms**
Set up alarms for:
- Function errors
- Duration exceeding threshold
- Function failures

### **Example Alarm**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "lp-backup-errors" \
  --alarm-description "Alert when backup function has errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=FunctionName,Value=lp-management-scheduled-backup \
  --evaluation-periods 1 \
  --region eu-west-2
```

## 🔄 Updates

### **Update Function Code**
```bash
# After making changes, repackage and update
zip -r lambda-backup.zip . -x "*.md" "deploy-instructions.md"

aws lambda update-function-code \
  --function-name lp-management-scheduled-backup \
  --zip-file fileb://lambda-backup.zip \
  --region eu-west-2
```

### **Update Configuration**
```bash
aws lambda update-function-configuration \
  --function-name lp-management-scheduled-backup \
  --timeout 900 \
  --memory-size 1024 \
  --region eu-west-2
```

## 🛠️ Troubleshooting

### **Common Issues**

#### **1. Timeout Errors**
- Increase Lambda timeout (max 15 minutes)
- Increase memory allocation
- Optimize data processing

#### **2. Memory Errors**
- Increase Lambda memory
- Process data in smaller batches
- Optimize Excel generation

#### **3. SES Email Failures**
- Verify email addresses in SES
- Check SES sending limits
- Ensure proper IAM permissions

#### **4. DynamoDB Access Issues**
- Verify IAM role permissions
- Check table names and regions
- Ensure tables exist

### **Debug Commands**
```bash
# Check function configuration
aws lambda get-function --function-name lp-management-scheduled-backup --region eu-west-2

# Check function logs
aws logs tail /aws/lambda/lp-management-scheduled-backup --follow --region eu-west-2

# Test function with sample event
aws lambda invoke \
  --function-name lp-management-scheduled-backup \
  --payload '{}' \
  --region eu-west-2 \
  test-response.json
```

## 📞 Support

For issues with the scheduled backup:
1. Check CloudWatch logs for detailed error information
2. Verify all environment variables are set correctly
3. Test the function manually before relying on scheduling
4. Ensure AWS SES is properly configured
5. Contact system administrator for assistance

---

**Note**: This Lambda function is designed to run automatically and requires minimal maintenance. Regular monitoring of CloudWatch logs is recommended to ensure reliable operation.
