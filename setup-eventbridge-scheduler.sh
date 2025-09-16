#!/bin/bash

# AWS EventBridge Scheduler Setup for LP Management Email Reports
# This script sets up automated scheduling for email reports

echo "🚀 Setting up AWS EventBridge scheduler for LP Management Email Reports..."

# Configuration
RULE_NAME="lp-management-email-reports-scheduler"
FUNCTION_NAME="lp-management-scheduler"
REGION="eu-west-2"
ACCOUNT_ID="393157401543"
APP_URL="https://d1xccxyuhu9vi.amplifyapp.com"

echo "📋 Configuration:"
echo "  Rule Name: $RULE_NAME"
echo "  Region: $REGION"
echo "  Account ID: $ACCOUNT_ID"
echo "  App URL: $APP_URL"

# 1. Create EventBridge Rule (runs every hour)
echo "📅 Creating EventBridge rule..."
aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "rate(1 hour)" \
  --description "Triggers LP Management email reports scheduler every hour" \
  --region "$REGION"

# 2. Create Lambda function for scheduler
echo "🔧 Creating Lambda function..."
cat > lambda-scheduler.js << 'EOF'
const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const APP_URL = process.env.APP_URL;
  
  if (!APP_URL) {
    throw new Error('APP_URL environment variable not set');
  }
  
  const url = `${APP_URL}/api/scheduler/`;
  
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LP-Management-Scheduler/1.0',
      },
      timeout: 300000, // 5 minutes timeout
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('Scheduler execution result:', result);
          resolve({
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              message: 'Scheduler executed successfully',
              result: result
            })
          });
        } catch (error) {
          console.error('Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};
EOF

# Create deployment package
zip lambda-scheduler.zip lambda-scheduler.js

# Create Lambda function
aws lambda create-function \
  --function-name "$FUNCTION_NAME" \
  --runtime nodejs18.x \
  --role "arn:aws:iam::$ACCOUNT_ID:role/lp-management-scheduler-role" \
  --handler lambda-scheduler.handler \
  --zip-file fileb://lambda-scheduler.zip \
  --timeout 300 \
  --environment Variables="{APP_URL=$APP_URL}" \
  --region "$REGION"

# 3. Add EventBridge target
echo "🎯 Adding EventBridge target..."
aws events put-targets \
  --rule "$RULE_NAME" \
  --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME" \
  --region "$REGION"

# 4. Grant EventBridge permission to invoke Lambda
echo "🔐 Granting EventBridge permission..."
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "allow-eventbridge" \
  --action "lambda:InvokeFunction" \
  --principal "events.amazonaws.com" \
  --source-arn "arn:aws:events:$REGION:$ACCOUNT_ID:rule/$RULE_NAME" \
  --region "$REGION"

# 5. Create IAM role for Lambda
echo "👤 Creating IAM role..."
cat > scheduler-role-policy.json << 'EOF'
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
    }
  ]
}
EOF

aws iam create-role \
  --role-name "lp-management-scheduler-role" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

aws iam put-role-policy \
  --role-name "lp-management-scheduler-role" \
  --policy-name "SchedulerPolicy" \
  --policy-document file://scheduler-role-policy.json

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update APP_URL in this script with your actual Amplify URL"
echo "2. Run: chmod +x setup-eventbridge-scheduler.sh"
echo "3. Run: ./setup-eventbridge-scheduler.sh"
echo ""
echo "🧪 Test the setup:"
echo "aws lambda invoke --function-name $FUNCTION_NAME --region $REGION test-output.json"
echo "cat test-output.json"
