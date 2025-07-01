# 📁 Bulk Upload Guide - Water Tap Asset Management

## 🎯 Overview
The enhanced bulk upload functionality allows you to import multiple assets at once using CSV or Excel files with improved validation, duplicate detection, and automatic asset type creation.

## 📋 Required Fields (Only These Are Mandatory)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `assetBarcode*` | String | Unique identifier for the asset | B30674 |
| `room*` | String | Room location | Room 101 |
| `filterNeeded*` | YES/NO | Whether the asset needs filters | YES |
| `filterInstalledOn` | Date | Required only if filterNeeded = YES | 2024-10-01 |

**Note:** `filterExpiryDate` is auto-calculated as `filterInstalledOn + 90 days` and should NOT be included in uploads.

## 🔧 Optional Fields
All other fields are optional and will use default values if not provided:

- `assetType` - Will auto-create new types if they don't exist
- `primaryIdentifier` - Defaults to assetBarcode if not provided
- `status` - Defaults to 'ACTIVE'
- `wing`, `wingInShort`, `floor`, `floorInWords`
- `roomNo`, `roomName`
- `secondaryIdentifier`
- `filtersOn` - Defaults to false
- `notes`
- `augmentedCare` - Defaults to false

## ✅ Validation Rules

### 1. Duplicate Barcode Detection
- Checks against existing assets in the database
- Prevents duplicates within the same upload batch
- Shows detailed error messages with row numbers

### 2. Required Field Validation
- `assetBarcode` must not be empty
- `room` must not be empty
- `filterNeeded` must be YES/NO (or true/false, 1/0, y/n)
- `filterInstalledOn` required only if `filterNeeded` = YES

### 3. Date Format Support
Accepts multiple date formats:
- YYYY-MM-DD (2024-10-01)
- MM/DD/YYYY (10/01/2024)
- DD/MM/YYYY (01/10/2024)
- Excel date serial numbers

## 🏷️ Auto-Create Asset Types
- If an `assetType` is provided that doesn't exist, it will be automatically created
- New asset types are immediately available for future uploads and manual entry
- Shows summary of newly created types after upload

## 📊 File Format Support

### CSV Files (.csv)
```csv
assetBarcode*,room*,filterNeeded*,filterInstalledOn,assetType
B30674,Room 101,YES,2024-10-01,Water Tap
B30675,Room 102,NO,,Water Cooler
```

### Excel Files (.xlsx, .xls)
- Use the first worksheet
- Headers in the first row
- Data starting from row 2

## 📥 Upload Process

1. **Download Template**
   - Click "Download Template" to get the latest CSV template
   - Required fields are marked with `*`

2. **Prepare Your Data**
   - Fill in required fields for each asset
   - Add optional fields as needed
   - Use YES/NO for boolean fields

3. **Upload File**
   - Select your CSV or Excel file
   - Click "Upload Assets"
   - Review the results summary

## 📊 Upload Results

After upload, you'll see a detailed summary:

### ✅ Success Metrics
- Total records processed
- Successfully imported assets
- Failed imports with reasons

### 🏷️ Auto-Created Asset Types
- List of new asset types created during upload
- These are now available in dropdowns

### 🚫 Duplicate Barcodes
- List of barcodes that already exist
- Helps identify data that needs updating vs. creating

### ❌ Error Details
- Up to 20 detailed error messages
- Row numbers and specific issues
- Helps fix data before re-upload

## 💡 Best Practices

1. **Start Small**: Test with a few records first
2. **Use Template**: Always start with the downloaded template
3. **Check Duplicates**: Review existing assets before bulk upload
4. **Date Consistency**: Use consistent date formats throughout your file
5. **Asset Types**: Let the system auto-create new types rather than pre-creating them

## 🔄 Sample Data

See `sample_bulk_upload.csv` for example data format:

```csv
assetBarcode*,room*,filterNeeded*,filterInstalledOn,assetType,notes
B30674,Room 101,YES,2024-10-01,Water Tap,Working condition
B30675,Room 102,NO,,Water Cooler,No filter required
B30676,Room 103,YES,2024-09-15,LNS Outlet - TMT,Maintenance needed
```

## 🚨 Common Issues

### Upload Failures
- **Empty required fields**: Ensure assetBarcode and room are filled
- **Invalid dates**: Use YYYY-MM-DD format for best compatibility
- **Duplicate barcodes**: Check against existing assets

### Data Quality
- **Inconsistent asset types**: Let the system auto-create to avoid typos
- **Missing filter dates**: Required when filterNeeded = YES
- **Boolean values**: Use YES/NO, true/false, or 1/0

## 🔗 Integration
- All uploaded assets appear immediately in the main asset list
- Audit logs are created for each imported asset
- New asset types are available in all dropdowns
- Filter expiry dates are automatically calculated and tracked

---

**Need Help?** The system provides detailed error messages to guide you through any issues. Start with the template and add data gradually to ensure successful imports. 