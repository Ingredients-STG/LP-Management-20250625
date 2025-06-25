#!/bin/bash

# Create IAM Role for AWS Amplify
echo "🔐 Creating IAM role for AWS Amplify..."

ROLE_NAME="AmplifyServiceRole-WaterTapAssets"
POLICY_NAME="AmplifyServicePolicy-WaterTapAssets"

# Create trust policy for Amplify service
cat > amplify-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "amplify.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

# Create the IAM role
echo "📝 Creating IAM role: $ROLE_NAME"
aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file://amplify-trust-policy.json \
    --description "Service role for AWS Amplify to deploy Water Tap Asset Management app"

# Create custom policy for Amplify permissions
cat > amplify-service-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams",
                "logs:DescribeLogGroups"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": [
                "arn:aws:s3:::amplify-*",
                "arn:aws:s3:::amplify-*/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "amplify:GetApp",
                "amplify:GetBranch",
                "amplify:UpdateApp",
                "amplify:UpdateBranch",
                "amplify:CreateDeployment",
                "amplify:StartDeployment",
                "amplify:StopDeployment"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "codecommit:GitPull",
                "codecommit:GitPush"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Create and attach the custom policy
echo "📋 Creating custom policy: $POLICY_NAME"
POLICY_ARN=$(aws iam create-policy \
    --policy-name $POLICY_NAME \
    --policy-document file://amplify-service-policy.json \
    --description "Custom policy for Amplify service role" \
    --query 'Policy.Arn' \
    --output text)

echo "🔗 Attaching custom policy to role..."
aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn $POLICY_ARN

# Attach AWS managed policies
echo "🔗 Attaching AWS managed policies..."
aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAmplifyExecutionRole

# Wait for role to propagate
echo "⏳ Waiting for IAM role to propagate..."
sleep 10

# Get the role ARN
ROLE_ARN=$(aws iam get-role \
    --role-name $ROLE_NAME \
    --query 'Role.Arn' \
    --output text)

echo "✅ IAM role created successfully!"
echo "🔗 Role ARN: $ROLE_ARN"
echo ""
echo "📝 Next steps:"
echo "1. Go to AWS Amplify Console: https://eu-west-2.console.aws.amazon.com/amplify/home?region=eu-west-2#/d25j5qt77sjegi"
echo "2. Click on 'App settings' → 'General'"
echo "3. Under 'Service role', click 'Edit'"
echo "4. Select the role: $ROLE_NAME"
echo "5. Click 'Save'"
echo "6. Go to 'Hosting' → 'main' and click 'Redeploy this version'"

# Clean up temporary files
rm amplify-trust-policy.json amplify-service-policy.json

echo ""
echo "🎯 Role ARN to use in Amplify Console:"
echo "$ROLE_ARN" 