#!/bin/bash

# S3 Static Website Deployment Script
echo "🚀 Deploying Water Tap Asset Management to S3..."

BUCKET_NAME="water-tap-asset-management-$(date +%s)"
REGION="eu-west-2"

# Create S3 bucket
echo "📦 Creating S3 bucket: $BUCKET_NAME"
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Configure bucket for static website hosting
echo "🌐 Configuring static website hosting..."
aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html

# Set bucket policy for public read access
echo "🔓 Setting bucket policy for public access..."
cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json

# Upload website files
echo "📤 Uploading website files..."
aws s3 sync src/ s3://$BUCKET_NAME --delete

# Output website URL
WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo "✅ Deployment complete!"
echo "🌐 Website URL: $WEBSITE_URL"

# Clean up
rm bucket-policy.json

echo ""
echo "📝 Your Water Tap Asset Management System is now live at:"
echo "   $WEBSITE_URL" 