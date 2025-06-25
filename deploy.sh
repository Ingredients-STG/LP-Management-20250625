#!/bin/bash

# Water Tap Asset Management - AWS Deployment Script
echo "🚰 Deploying Water Tap Asset Management System..."

# Set variables
REGION="eu-west-2"
STACK_NAME="water-tap-asset-management"
FUNCTION_NAME="water-tap-asset-lambda"
API_NAME="water-tap-asset-api"
TABLE_PREFIX="WaterTapAsset"

# Create DynamoDB Tables
echo "📊 Creating DynamoDB tables..."

# Assets Table
aws dynamodb create-table \
    --table-name "${TABLE_PREFIX}Assets" \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=assetBarcode,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        IndexName=assetBarcode-index,KeySchema=[{AttributeName=assetBarcode,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region $REGION

# Maintenance Table
aws dynamodb create-table \
    --table-name "${TABLE_PREFIX}Maintenance" \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=assetId,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
        IndexName=assetId-index,KeySchema=[{AttributeName=assetId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region $REGION

# Locations Table
aws dynamodb create-table \
    --table-name "${TABLE_PREFIX}Locations" \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region $REGION

echo "⏳ Waiting for tables to be created..."
sleep 30

# Create IAM Role for Lambda
echo "🔐 Creating IAM role..."
ROLE_ARN=$(aws iam create-role \
    --role-name water-tap-lambda-role \
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
    }' \
    --query 'Role.Arn' \
    --output text \
    --region $REGION)

# Attach policies to the role
aws iam attach-role-policy \
    --role-name water-tap-lambda-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    --region $REGION

aws iam put-role-policy \
    --role-name water-tap-lambda-role \
    --policy-name DynamoDBAccessPolicy \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:Scan",
                    "dynamodb:Query"
                ],
                "Resource": [
                    "arn:aws:dynamodb:'$REGION':*:table/'$TABLE_PREFIX'Assets",
                    "arn:aws:dynamodb:'$REGION':*:table/'$TABLE_PREFIX'Assets/index/*",
                    "arn:aws:dynamodb:'$REGION':*:table/'$TABLE_PREFIX'Maintenance",
                    "arn:aws:dynamodb:'$REGION':*:table/'$TABLE_PREFIX'Maintenance/index/*",
                    "arn:aws:dynamodb:'$REGION':*:table/'$TABLE_PREFIX'Locations"
                ]
            }
        ]
    }' \
    --region $REGION

echo "⏳ Waiting for IAM role to propagate..."
sleep 10

# Create Lambda function
echo "⚡ Creating Lambda function..."
cd lambda-function
zip -r ../function.zip .
cd ..

aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://function.zip \
    --environment Variables="{ASSETS_TABLE=${TABLE_PREFIX}Assets,MAINTENANCE_TABLE=${TABLE_PREFIX}Maintenance,LOCATIONS_TABLE=${TABLE_PREFIX}Locations}" \
    --region $REGION

# Create API Gateway
echo "🌐 Creating API Gateway..."
API_ID=$(aws apigateway create-rest-api \
    --name $API_NAME \
    --description "Water Tap Asset Management API" \
    --query 'id' \
    --output text \
    --region $REGION)

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --query 'items[0].id' \
    --output text \
    --region $REGION)

# Create 'items' resource
ITEMS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part items \
    --query 'id' \
    --output text \
    --region $REGION)

# Create proxy resource
PROXY_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ITEMS_RESOURCE_ID \
    --path-part '{proxy+}' \
    --query 'id' \
    --output text \
    --region $REGION)

# Create ANY method for proxy resource
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --authorization-type NONE \
    --region $REGION

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function \
    --function-name $FUNCTION_NAME \
    --query 'Configuration.FunctionArn' \
    --output text \
    --region $REGION)

# Create integration
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $REGION

# Add permission for API Gateway to invoke Lambda
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id api-gateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:*:$API_ID/*/*/*" \
    --region $REGION

# Deploy API
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name dev \
    --region $REGION

# Output API URL
API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/dev"
echo "✅ Deployment complete!"
echo "🌐 API URL: $API_URL"
echo ""
echo "📝 Next steps:"
echo "1. Update the API_BASE_URL in src/app.js with: $API_URL"
echo "2. Upload your frontend files to S3 or use Amplify Console for hosting"
echo ""
echo "🔗 Resources created:"
echo "- DynamoDB Tables: ${TABLE_PREFIX}Assets, ${TABLE_PREFIX}Maintenance, ${TABLE_PREFIX}Locations"
echo "- Lambda Function: $FUNCTION_NAME"
echo "- API Gateway: $API_NAME ($API_ID)"

# Clean up
rm -f function.zip 