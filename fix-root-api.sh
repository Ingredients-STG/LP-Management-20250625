#!/bin/bash

echo "🔧 Configuring API Gateway for root-level paths..."

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

# Get root resource
ROOT_RESOURCE_ID=$(echo $RESOURCES | jq -r '.[] | select(.path == "/") | .id')
echo "🏠 Root Resource ID: $ROOT_RESOURCE_ID"

# Create proxy resource at root level for all paths
echo "📁 Creating root /{proxy+} resource..."
ROOT_PROXY_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part '{proxy+}' \
    --query 'id' \
    --output text 2>/dev/null || echo "Resource may already exist")

if [ "$ROOT_PROXY_RESOURCE_ID" = "Resource may already exist" ]; then
    # Get existing proxy resource at root
    ROOT_PROXY_RESOURCE_ID=$(echo $RESOURCES | jq -r '.[] | select(.path == "/{proxy+}") | .id')
fi

echo "🔗 Root Proxy Resource ID: $ROOT_PROXY_RESOURCE_ID"

if [ -n "$ROOT_PROXY_RESOURCE_ID" ] && [ "$ROOT_PROXY_RESOURCE_ID" != "null" ]; then
    # Set up ANY method for the root proxy resource
    echo "🔧 Setting up ANY method for root proxy..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $ROOT_PROXY_RESOURCE_ID \
        --http-method ANY \
        --authorization-type NONE \
        --no-api-key-required 2>/dev/null || echo "Method may already exist"

    # Set up Lambda integration for root proxy
    echo "🔧 Setting up Lambda integration for root proxy..."
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $ROOT_PROXY_RESOURCE_ID \
        --http-method ANY \
        --type AWS_PROXY \
        --integration-http-method POST \
        --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" 2>/dev/null || echo "Integration may already exist"

    # Set up OPTIONS method for CORS on root proxy
    echo "🌐 Setting up CORS for root proxy..."
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $ROOT_PROXY_RESOURCE_ID \
        --http-method OPTIONS \
        --authorization-type NONE \
        --no-api-key-required 2>/dev/null || echo "OPTIONS method may already exist"

    # CORS integration for OPTIONS on root proxy
    aws apigateway put-integration \
        --rest-api-id $API_ID \
        --resource-id $ROOT_PROXY_RESOURCE_ID \
        --http-method OPTIONS \
        --type MOCK \
        --integration-http-method OPTIONS \
        --request-templates '{"application/json": "{\"statusCode\": 200}"}' 2>/dev/null || echo "OPTIONS integration may already exist"

    # CORS method response on root proxy
    aws apigateway put-method-response \
        --rest-api-id $API_ID \
        --resource-id $ROOT_PROXY_RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers": false, "method.response.header.Access-Control-Allow-Methods": false, "method.response.header.Access-Control-Allow-Origin": false}' 2>/dev/null || echo "OPTIONS method response may already exist"

    # CORS integration response on root proxy
    aws apigateway put-integration-response \
        --rest-api-id $API_ID \
        --resource-id $ROOT_PROXY_RESOURCE_ID \
        --http-method OPTIONS \
        --status-code 200 \
        --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'\''", "method.response.header.Access-Control-Allow-Methods": "'\''GET,POST,PUT,DELETE,OPTIONS'\''", "method.response.header.Access-Control-Allow-Origin": "'\''https://main.d25j5qt77sjegi.amplifyapp.com'\''"}' \
        --response-templates '{"application/json": ""}' 2>/dev/null || echo "OPTIONS integration response may already exist"
fi

# Add Lambda permission for root proxy
echo "🔐 Adding Lambda permission for root proxy..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id api-gateway-invoke-root-$(date +%s) \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" 2>/dev/null || echo "Permission may already exist"

# Deploy the API
echo "🚀 Deploying API changes..."
aws apigateway create-deployment --rest-api-id $API_ID --stage-name dev

echo "✅ API Gateway configuration complete!"
echo "🌐 API URL: https://$API_ID.execute-api.$REGION.amazonaws.com/dev"

# Test the API
echo "🧪 Testing API endpoints..."
echo "Testing /assets:"
curl -X GET "https://$API_ID.execute-api.$REGION.amazonaws.com/dev/assets" -H "Content-Type: application/json" 
echo -e "\n\nTesting /dashboard:"
curl -X GET "https://$API_ID.execute-api.$REGION.amazonaws.com/dev/dashboard" -H "Content-Type: application/json"
echo -e "\n" 