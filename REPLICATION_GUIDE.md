# LP Management Application - Complete Replication Guide

## 📋 Overview
This guide provides step-by-step instructions to replicate the LP Management application in a new AWS account and GitHub repository. The application is a comprehensive water tap asset management system built with Next.js, TypeScript, and AWS services.

## 🏗️ Architecture Overview

### **Frontend Stack**
- **Framework**: Next.js 15.3.4 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Mantine UI Components
- **State Management**: React Context + Hooks
- **Authentication**: AWS Cognito
- **Charts**: Recharts via Mantine Charts
- **File Processing**: XLSX for Excel/CSV handling

### **Backend Stack**
- **Runtime**: Node.js on AWS Lambda (via Next.js API Routes)
- **Database**: AWS DynamoDB
- **File Storage**: AWS S3
- **Authentication**: AWS Cognito User Pool
- **Hosting**: AWS Amplify
- **Region**: eu-west-2 (configurable)



## 🔧 AWS Services Required

### **Core Services**
1. **DynamoDB Tables**:
   - `water-tap-assets` - Main assets table
   - `AssetTypes` - Asset type definitions
   - `FilterTypes` - Filter type definitions
   - `AssetAuditLogs` - Audit trail logs

2. **S3 Buckets**:
   - `asset-files-{environment}` - File storage for asset documents

3. **Cognito User Pool**:
   - User authentication and management
   - Email-based sign-in
   - User registration with verification

4. **Amplify Hosting**:
   - Automatic deployment from GitHub
   - Environment variable management
   - Build and deployment pipeline

5. **IAM Roles & Policies**:
   - DynamoDB read/write permissions
   - S3 bucket access
   - Cognito user management

## 📦 Required Environment Variables

### **AWS Credentials**
```env
AMPLIFY_ACCESS_KEY_ID=your-aws-access-key-id
AMPLIFY_SECRET_ACCESS_KEY=your-aws-secret-access-key
AMPLIFY_AWS_REGION=eu-west-2
```

### **Application Configuration**
```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-gateway-url.execute-api.eu-west-2.amazonaws.com/dev
NEXT_PUBLIC_APP_NAME="LP Management System"
NEXT_PUBLIC_APP_VERSION="1.0.0"
NODE_ENV=production
```

## 🚀 Step-by-Step Replication Process

### **Phase 1: GitHub Repository Setup**

1. **Create New Repository**:
   ```bash
   # Create new repository on GitHub
   # Clone this existing repository
   git clone https://github.com/your-username/lp-management.git
   cd lp-management
   
   # Add new remote
   git remote add new-origin https://github.com/new-account/new-repo.git
   
   # Push to new repository
   git push new-origin main
   ```

2. **Update Repository Settings**:
   - Enable GitHub Actions (if needed)
   - Set up branch protection rules
   - Configure repository secrets for AWS credentials

### **Phase 2: AWS Account Setup**

#### **Step 1: Configure AWS CLI**
```bash
# Install AWS CLI if not already installed
pip install awscli

# Configure with new account credentials
aws configure --profile new-account
# Enter: Access Key ID, Secret Access Key, Region (eu-west-2), Output format (json)
```

#### **Step 2: Create DynamoDB Tables**
```bash
# Create main assets table
aws dynamodb create-table \
  --table-name water-tap-assets \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-2 \
  --profile new-account

# Create asset types table
aws dynamodb create-table \
  --table-name AssetTypes \
  --attribute-definitions AttributeName=typeId,AttributeType=S \
  --key-schema AttributeName=typeId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-2 \
  --profile new-account

# Create filter types table
aws dynamodb create-table \
  --table-name FilterTypes \
  --attribute-definitions AttributeName=typeId,AttributeType=S \
  --key-schema AttributeName=typeId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-2 \
  --profile new-account

# Create audit logs table
aws dynamodb create-table \
  --table-name AssetAuditLogs \
  --attribute-definitions \
    AttributeName=assetId,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=assetId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-2 \
  --profile new-account
```

#### **Step 3: Create S3 Bucket**
```bash
# Create S3 bucket for file storage
aws s3 mb s3://asset-files-prod --region eu-west-2 --profile new-account

# Configure bucket policy for public read access (if needed)
aws s3api put-bucket-policy \
  --bucket asset-files-prod \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "PublicReadGetObject",
        "Effect": "Allow",
        "Principal": "*",
        "Action": "s3:GetObject",
        "Resource": "arn:aws:s3:::asset-files-prod/*"
      }
    ]
  }' \
  --profile new-account
```

#### **Step 4: Create Cognito User Pool**
```bash
# Create Cognito User Pool
aws cognito-idp create-user-pool \
  --pool-name "LP-Management-Users" \
  --username-configuration CaseSensitive=false \
  --auto-verified-attributes email \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --region eu-west-2 \
  --profile new-account

# Note the UserPoolId from the response

# Create User Pool Client
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name "LP-Management-Client" \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --region eu-west-2 \
  --profile new-account

# Note the ClientId from the response
```

#### **Step 5: Create IAM Role for Application**
```bash
# Create IAM policy for application permissions
aws iam create-policy \
  --policy-name LP-Management-Policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:Query",
          "dynamodb:CreateTable",
          "dynamodb:DescribeTable"
        ],
        "Resource": [
          "arn:aws:dynamodb:eu-west-2:*:table/water-tap-assets",
          "arn:aws:dynamodb:eu-west-2:*:table/AssetTypes",
          "arn:aws:dynamodb:eu-west-2:*:table/FilterTypes",
          "arn:aws:dynamodb:eu-west-2:*:table/AssetAuditLogs"
        ]
      },
      {
        "Effect": "Allow",
        "Action": [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ],
        "Resource": "arn:aws:s3:::asset-files-prod/*"
      }
    ]
  }' \
  --profile new-account

# Create IAM user for application
aws iam create-user \
  --user-name lp-management-app \
  --profile new-account

# Attach policy to user
aws iam attach-user-policy \
  --user-name lp-management-app \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/LP-Management-Policy \
  --profile new-account

# Create access keys
aws iam create-access-key \
  --user-name lp-management-app \
  --profile new-account
```

### **Phase 3: Application Configuration**

#### **Step 1: Update Configuration Files**

1. **Update `src/lib/cognito.ts`**:
   ```typescript
   const cognitoConfig = {
     Auth: {
       Cognito: {
         userPoolId: 'YOUR_NEW_USER_POOL_ID',
         userPoolClientId: 'YOUR_NEW_CLIENT_ID',
         signUpVerificationMethod: 'code' as const,
         loginWith: {
           email: true,
           username: false
         }
       }
     }
   };
   ```

2. **Update `amplify.yml`**:
   ```yaml
   version: 1
   backend:
     phases:
       build:
         commands:
           - echo "No backend build required - using existing AWS Lambda API"
   frontend:
     phases:
       preBuild:
         commands:
           - echo "Installing dependencies..."
           - npm install --legacy-peer-deps
       build:
         commands:
           - echo "Creating .env.production file..."
           - env | grep -e AMPLIFY_ACCESS_KEY_ID >> .env.production
           - env | grep -e AMPLIFY_SECRET_ACCESS_KEY >> .env.production
           - env | grep -e AMPLIFY_AWS_REGION >> .env.production
           - echo "Building application..."
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
         - .next/cache/**/*
   ```

### **Phase 4: AWS Amplify Setup**

#### **Step 1: Create Amplify Application**
```bash
# Create Amplify app
aws amplify create-app \
  --name "LP-Management" \
  --description "LP Management System" \
  --region eu-west-2 \
  --profile new-account

# Note the appId from the response
```

#### **Step 2: Connect GitHub Repository**
```bash
# Create branch
aws amplify create-branch \
  --app-id YOUR_APP_ID \
  --branch-name main \
  --region eu-west-2 \
  --profile new-account

# Connect repository (this requires GitHub token)
# Do this through AWS Console: Amplify > Your App > Connect Repository
```

#### **Step 3: Configure Environment Variables**
```bash
# Set environment variables in Amplify
aws amplify put-backend-environment \
  --app-id YOUR_APP_ID \
  --environment-name production \
  --region eu-west-2 \
  --profile new-account

# Add environment variables through AWS Console:
# Amplify > Your App > Environment Variables
```

### **Phase 5: Data Migration (Optional)**

#### **Step 1: Export Data from Original Account**
```bash
# Export assets data
aws dynamodb scan \
  --table-name water-tap-assets \
  --region eu-west-2 \
  --profile original-account > assets-backup.json

# Export asset types
aws dynamodb scan \
  --table-name AssetTypes \
  --region eu-west-2 \
  --profile original-account > asset-types-backup.json

# Export filter types
aws dynamodb scan \
  --table-name FilterTypes \
  --region eu-west-2 \
  --profile original-account > filter-types-backup.json
```

#### **Step 2: Import Data to New Account**
```bash
# Import assets (you'll need to process the JSON and use batch-write-item)
# This requires custom scripting based on your data structure
```

### **Phase 6: Testing & Deployment**

#### **Step 1: Local Testing**
```bash
# Install dependencies
npm install

# Create .env.local for local development
echo "AMPLIFY_ACCESS_KEY_ID=your-access-key" > .env.local
echo "AMPLIFY_SECRET_ACCESS_KEY=your-secret-key" >> .env.local
echo "AMPLIFY_AWS_REGION=eu-west-2" >> .env.local

# Start development server
npm run dev
```

#### **Step 2: Deploy to Amplify**
```bash
# Push changes to GitHub
git add .
git commit -m "Configure for new AWS account"
git push origin main

# Amplify will automatically deploy
```

## 📋 Verification Checklist

### **AWS Services**
- [ ] DynamoDB tables created and accessible
- [ ] S3 bucket created with proper permissions
- [ ] Cognito User Pool configured
- [ ] IAM roles and policies set up
- [ ] Amplify app connected to GitHub

### **Application**
- [ ] Environment variables configured
- [ ] Cognito configuration updated
- [ ] Local development server runs successfully
- [ ] Can connect to DynamoDB tables
- [ ] Can upload files to S3
- [ ] Authentication works with Cognito

### **Deployment**
- [ ] Amplify deployment successful
- [ ] Application accessible via Amplify URL
- [ ] All API endpoints working
- [ ] Database operations functional
- [ ] File uploads working

## 🔧 Configuration Files Summary

### **Key Files to Update**
1. `src/lib/cognito.ts` - Cognito configuration
2. `amplify.yml` - Build configuration
3. `package.json` - Dependencies and scripts
4. Environment variables in Amplify Console

### **Database Schema**
The application uses the following DynamoDB table structure:

#### **water-tap-assets Table**
- Primary Key: `id` (String)
- Attributes: All asset properties as defined in the Asset interface

#### **AssetTypes Table**
- Primary Key: `typeId` (String)
- Attributes: `label`, `createdAt`, `createdBy`

#### **FilterTypes Table**
- Primary Key: `typeId` (String)
- Attributes: `label`, `createdAt`, `createdBy`

#### **AssetAuditLogs Table**
- Primary Key: `assetId` (String)
- Sort Key: `timestamp` (String)
- Attributes: `action`, `oldValues`, `newValues`, `modifiedBy`

## 🆘 Troubleshooting

### **Common Issues**

1. **CORS Issues**:
   - Ensure API Gateway has proper CORS configuration
   - Check that the proxy API route is working

2. **Authentication Issues**:
   - Verify Cognito User Pool and Client IDs
   - Check that environment variables are set correctly

3. **Database Connection Issues**:
   - Verify AWS credentials have proper permissions
   - Check that DynamoDB tables exist in the correct region

4. **Build Issues**:
   - Ensure all dependencies are installed
   - Check that environment variables are available during build

### **Support Resources**
- AWS Documentation: https://docs.aws.amazon.com/
- Next.js Documentation: https://nextjs.org/docs
- Amplify Documentation: https://docs.amplify.aws/

## 📞 Final Notes

This replication guide provides a complete blueprint for recreating the LP Management application. The process involves:

1. **Infrastructure Setup**: Creating all necessary AWS resources
2. **Configuration**: Updating application configuration files
3. **Deployment**: Setting up Amplify for continuous deployment
4. **Testing**: Verifying all functionality works correctly

**Estimated Time**: 2-4 hours for complete setup
**Prerequisites**: AWS CLI, Node.js, Git, GitHub account
**Cost**: Minimal AWS costs for small-scale usage (mostly free tier eligible)

The application will be fully functional with the same features as the original, including:
- Asset management dashboard
- CRUD operations for assets
- Bulk upload via CSV/Excel
- File attachments
- User authentication
- Audit logging

Remember to update any hardcoded URLs or region-specific configurations to match your new AWS account setup. 