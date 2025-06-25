#!/bin/bash

# Add CloudFormation permissions to Amplify role
echo "🔧 Adding CloudFormation permissions to Amplify role..."

ROLE_NAME="AmplifyServiceRole-WaterTapAssets"
POLICY_NAME="AmplifyCloudFormationPolicy"

# Create CloudFormation policy
cat > cloudformation-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:UpdateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks",
                "cloudformation:DescribeStackEvents",
                "cloudformation:DescribeStackResource",
                "cloudformation:DescribeStackResources",
                "cloudformation:ListStackResources",
                "cloudformation:GetTemplate",
                "cloudformation:ValidateTemplate",
                "cloudformation:CreateChangeSet",
                "cloudformation:DescribeChangeSet",
                "cloudformation:ExecuteChangeSet",
                "cloudformation:DeleteChangeSet",
                "cloudformation:ListStacks",
                "cloudformation:ListChangeSets"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:GetRole",
                "iam:PassRole",
                "iam:UpdateRole",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:ListRolePolicies",
                "iam:ListAttachedRolePolicies",
                "iam:CreatePolicy",
                "iam:DeletePolicy",
                "iam:GetPolicy",
                "iam:ListPolicyVersions"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:CreateFunction",
                "lambda:DeleteFunction",
                "lambda:GetFunction",
                "lambda:UpdateFunctionCode",
                "lambda:UpdateFunctionConfiguration",
                "lambda:ListFunctions",
                "lambda:AddPermission",
                "lambda:RemovePermission"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:CreateTable",
                "dynamodb:DeleteTable",
                "dynamodb:DescribeTable",
                "dynamodb:ListTables",
                "dynamodb:UpdateTable"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "apigateway:*"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Create and attach the policy
echo "📋 Creating CloudFormation policy..."
POLICY_ARN=$(aws iam create-policy \
    --policy-name $POLICY_NAME \
    --policy-document file://cloudformation-policy.json \
    --description "CloudFormation permissions for Amplify" \
    --query 'Policy.Arn' \
    --output text 2>/dev/null || aws iam get-policy --policy-arn "arn:aws:iam::393157401543:policy/$POLICY_NAME" --query 'Policy.Arn' --output text)

echo "🔗 Attaching CloudFormation policy to role..."
aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn $POLICY_ARN

# Also add some AWS managed policies
echo "🔗 Adding additional AWS managed policies..."
aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationReadOnlyAccess 2>/dev/null || echo "Policy already attached or doesn't exist"

aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/IAMFullAccess 2>/dev/null || echo "IAM policy attachment failed - using custom policy instead"

# Clean up
rm cloudformation-policy.json

echo "✅ CloudFormation permissions added successfully!"
echo "🔄 Now trigger a new deployment by pushing a small change..." 