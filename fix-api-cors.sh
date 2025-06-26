#!/bin/bash

echo "🔧 Fixing API Gateway CORS and integration configuration..."

# Set the correct API ID
API_ID="r1iqp059n5"
REGION="eu-west-2"
FUNCTION_NAME="water-tap-asset-lambda"

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 Account ID: $ACCOUNT_ID"

# Lambda ARN
LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"

echo "📡 Configuring API Gateway: $API_ID"

# Get all resources
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --query "items" --output json)

# Find the proxy resource (should have path {proxy+})
PROXY_RESOURCE_ID=$(echo $RESOURCES | jq -r '.[] | select(.pathPart == "{proxy+}") | .id')

if [ -z "$PROXY_RESOURCE_ID" ]; then
    echo "❌ Proxy resource not found. Creating API structure..."
    
    # Get root resource
    ROOT_RESOURCE_ID=$(echo $RESOURCES | jq -r '.[] | select(.path == "/") | .id')
    
    # Create items resource
    echo "📁 Creating /items resource..."
    ITEMS_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ROOT_RESOURCE_ID \
        --path-part items \
        --query 'id' \
        --output text)
    
    # Create proxy resource
    echo "📁 Creating /{proxy+} resource..."
    PROXY_RESOURCE_ID=$(aws apigateway create-resource \
        --rest-api-id $API_ID \
        --parent-id $ITEMS_RESOURCE_ID \
        --path-part '{proxy+}' \
        --query 'id' \
        --output text)
fi

echo "🔗 Proxy Resource ID: $PROXY_RESOURCE_ID"

# Set up ANY method for the proxy resource
echo "🔧 Setting up ANY method..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --authorization-type NONE \
    --no-api-key-required

# Set up Lambda integration
echo "🔧 Setting up Lambda integration..."
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations"

# Add Lambda permission
echo "🔐 Adding Lambda permission..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id api-gateway-invoke-$(date +%s) \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" 2>/dev/null || echo "Permission may already exist"

# Set up OPTIONS method for CORS
echo "🌐 Setting up CORS..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --no-api-key-required

# CORS integration for OPTIONS
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --integration-http-method OPTIONS \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# CORS method response
aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": false, "method.response.header.Access-Control-Allow-Methods": false, "method.response.header.Access-Control-Allow-Origin": false}'

# CORS integration response
aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''", "method.response.header.Access-Control-Allow-Methods": "'\''GET,POST,PUT,DELETE,OPTIONS'\''", "method.response.header.Access-Control-Allow-Origin": "'\''*'\''"}' \
    --response-templates '{"application/json": ""}'

# Deploy the API
echo "🚀 Deploying API changes..."
aws apigateway create-deployment --rest-api-id $API_ID --stage-name dev

echo "✅ API Gateway configuration complete!"
echo "🌐 API URL: https://$API_ID.execute-api.$REGION.amazonaws.com/dev"

# Test the API
echo "🧪 Testing API..."
curl -X GET "https://$API_ID.execute-api.$REGION.amazonaws.com/dev/items/dashboard" -H "Content-Type: application/json" 