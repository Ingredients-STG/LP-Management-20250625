# AWS Lambda Deployment Instructions

## 📦 **Deployment Package Ready**
- **File**: `lambda-function.zip` (3.4 MB)
- **Location**: `/Users/srikanth/Documents/LP Management/lambda-deployment/`
- **Contains**: Updated Lambda function with backward compatibility

## 🚀 **Deploy to AWS Lambda**

### **Option 1: AWS CLI (Recommended)**

```bash
# Navigate to deployment directory
cd "/Users/srikanth/Documents/LP Management/lambda-deployment"

# Update your existing Lambda function
aws lambda update-function-code \
  --function-name InsertSPItemToDynamoDB \
  --zip-file fileb://lambda-function.zip \
  --region eu-west-2

# Verify the update
aws lambda get-function \
  --function-name InsertSPItemToDynamoDB \
  --region eu-west-2
```

### **Option 2: AWS Console**

1. **Go to AWS Lambda Console**: https://eu-west-2.console.aws.amazon.com/lambda/
2. **Find your function**: `InsertSPItemToDynamoDB`
3. **Upload new code**:
   - Click "Upload from" → ".zip file"
   - Select `lambda-function.zip`
   - Click "Save"

## ✅ **Post-Deployment Verification**

### **Test Filter Reconciliation (Existing)**
```json
{
  "AssetBarcode": "TEST123",
  "FilterType": "HEPA", 
  "Location": "Test Room"
}
```

### **Test LP Management (New)**
```json
{
  "tableName": "LPItems",
  "source": "sharepoint-power-automate",
  "items": [
    {
      "ItemInternalId": "test-123",
      "WO Number": "TEST001",
      "Asset Barcode": "B00001",
      "Sample Type": "Original",
      "Positive Count (Pre)": "50"
    }
  ]
}
```

## 🔧 **Environment Variables**
Make sure these are set in your Lambda function:
- `AWS_REGION` (should be `eu-west-2`)

## 📋 **What Changed**
✅ **Backward Compatible**: Existing Filter Reconciliation flows unchanged
✅ **New Feature**: LP Management support with `tableName: "LPItems"`
✅ **Bulk Operations**: Supports arrays of items
✅ **Error Handling**: Enhanced error reporting
✅ **Logging**: Improved console logging for debugging

## 🚨 **Important Notes**
- **Zero Downtime**: Existing Power Automate flows continue working
- **Same Endpoint**: No URL changes required
- **Same Authentication**: No credential changes needed
