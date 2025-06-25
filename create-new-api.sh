#!/bin/bash

# Create a new API Gateway with proper CORS and Lambda integration
echo "🚀 Creating a new API Gateway for Water Tap Asset Management..."

REGION="eu-west-2"
FUNCTION_NAME="water-tap-asset-lambda"
NEW_API_NAME="water-tap-asset-api-v2"

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 Account ID: $ACCOUNT_ID"

# Delete old API Gateway (optional)
echo "🗑️ Cleaning up old API (if needed)..."
aws apigateway delete-rest-api --rest-api-id sigcqzr25l --region $REGION 2>/dev/null || echo "Old API not found or already deleted"

# Create new API Gateway
echo "🌐 Creating new API Gateway..."
NEW_API_ID=$(aws apigateway create-rest-api \
    --name $NEW_API_NAME \
    --description "Water Tap Asset Management API with proper CORS" \
    --query 'id' \
    --output text \
    --region $REGION)

echo "📋 New API ID: $NEW_API_ID"

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $NEW_API_ID \
    --query 'items[0].id' \
    --output text \
    --region $REGION)

# Create /items resource
ITEMS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $NEW_API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part items \
    --query 'id' \
    --output text \
    --region $REGION)

# Create /{proxy+} resource under /items
PROXY_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $NEW_API_ID \
    --parent-id $ITEMS_RESOURCE_ID \
    --path-part '{proxy+}' \
    --query 'id' \
    --output text \
    --region $REGION)

# Create ANY method for the proxy resource
aws apigateway put-method \
    --rest-api-id $NEW_API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --authorization-type NONE \
    --region $REGION

# Create OPTIONS method for CORS
aws apigateway put-method \
    --rest-api-id $NEW_API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION

# Set up Lambda integration for ANY method
LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"
LAMBDA_URI="arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

aws apigateway put-integration \
    --rest-api-id $NEW_API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri $LAMBDA_URI \
    --region $REGION

# Set up CORS integration for OPTIONS method
aws apigateway put-integration \
    --rest-api-id $NEW_API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --integration-http-method OPTIONS \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION

# Set up method response for OPTIONS
aws apigateway put-method-response \
    --rest-api-id $NEW_API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false \
    --region $REGION

# Set up integration response for OPTIONS with CORS headers
aws apigateway put-integration-response \
    --rest-api-id $NEW_API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{
        "method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'",
        "method.response.header.Access-Control-Allow-Methods": "'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'",
        "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"
    }' \
    --region $REGION

# Add Lambda permission for the new API
echo "🔐 Adding Lambda permission for new API..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id "api-gateway-invoke-$NEW_API_ID" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$NEW_API_ID/*/*" \
    --region $REGION

# Deploy the API
echo "🚀 Deploying new API..."
aws apigateway create-deployment \
    --rest-api-id $NEW_API_ID \
    --stage-name dev \
    --region $REGION

# Output the new API URL
NEW_API_URL="https://$NEW_API_ID.execute-api.$REGION.amazonaws.com/dev"
echo "✅ New API Gateway created successfully!"
echo "🌐 New API URL: $NEW_API_URL"
echo ""
echo "📝 Update your frontend with the new API URL:"
echo "   Update API_BASE_URL in src/app.js to: $NEW_API_URL"
echo ""
echo "🧪 Test the new API:"
echo "   curl -X GET $NEW_API_URL/items/dashboard"
echo ""
echo "🔄 Next steps:"
echo "1. Update the API URL in your frontend"
echo "2. Test the API endpoints"
echo "3. Refresh your browser to see the changes" 