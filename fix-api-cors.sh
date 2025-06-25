#!/bin/bash

# Fix API Gateway CORS and Lambda Integration Issues
echo "🔧 Fixing API Gateway CORS and Lambda integration..."

API_ID="sigcqzr25l"
REGION="eu-west-2"
FUNCTION_NAME="water-tap-asset-lambda"

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 Account ID: $ACCOUNT_ID"

# Fix Lambda permission with correct account ID
echo "🔐 Fixing Lambda permissions..."
aws lambda remove-permission \
    --function-name $FUNCTION_NAME \
    --statement-id api-gateway-invoke \
    --region $REGION 2>/dev/null || echo "Old permission not found"

aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id api-gateway-invoke-fixed \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" \
    --region $REGION

# Get resources
echo "📋 Getting API Gateway resources..."
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)

# Get the proxy resource ID
PROXY_RESOURCE_ID=$(echo $RESOURCES | grep -o '"id":"[^"]*"' | grep -A1 -B1 proxy | head -1 | cut -d'"' -f4)

if [ -z "$PROXY_RESOURCE_ID" ]; then
    echo "❌ Proxy resource not found. Let's recreate the API structure..."
    
    # Get root resource
    ROOT_RESOURCE_ID=$(echo $RESOURCES | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    # Create items resource
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
    
    # Create ANY method
    aws apigateway put-method \
        --rest-api-id $API_ID \
        --resource-id $PROXY_RESOURCE_ID \
        --http-method ANY \
        --authorization-type NONE \
        --region $REGION
fi

echo "🔗 Proxy Resource ID: $PROXY_RESOURCE_ID"

# Update Lambda integration
echo "🔧 Setting up Lambda integration..."
LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $REGION

# Enable CORS for OPTIONS method
echo "🌐 Setting up CORS..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region $REGION

# Create CORS integration for OPTIONS
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --integration-http-method OPTIONS \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
    --region $REGION

# Set up CORS response for OPTIONS
aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false \
    --region $REGION

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --region $REGION

# Deploy the API
echo "🚀 Deploying API changes..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name dev \
    --region $REGION

echo "✅ API Gateway CORS and Lambda integration fixed!"
echo "🌐 API URL: https://$API_ID.execute-api.$REGION.amazonaws.com/dev"
echo ""
echo "🧪 Test the API:"
echo "curl -X GET https://$API_ID.execute-api.$REGION.amazonaws.com/dev/items/dashboard" 