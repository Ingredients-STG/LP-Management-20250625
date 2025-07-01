# 📊 CSV Upload API Documentation

## Endpoint
`POST /api/csv-upload`

## Description
Bulk upload assets from CSV or Excel files with validation, duplicate checking, and automatic asset type creation.

## Request Format
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Body**: FormData with file field

### Supported File Types
- `.csv` - Comma-separated values
- `.xlsx` - Excel 2007+ format
- `.xls` - Excel 97-2003 format

## Required Fields

| Field | Description | Example | Validation |
|-------|-------------|---------|------------|
| `Asset Barcode` | Unique asset identifier | B30680 | Required, must be unique |
| `Location` | Asset location/room | Room 301 | Required |
| `Filter Needed` | Whether asset needs filters | YES/NO | Required |
| `Filter Installed` | Installation date | 2024-10-01 | Required if Filter Needed = YES |

## Optional Fields

| Field | Description | Default |
|-------|-------------|---------|
| `Asset Type` | Type of asset | Auto-created if new |

## Header Variations Supported

The API supports flexible header naming:

### Asset Barcode
- `Asset Barcode`
- `assetBarcode`
- `asset_barcode`
- `Barcode`
- `barcode`

### Location
- `Location`
- `Room`
- `room`
- `location`

### Filter Needed
- `Filter Needed`
- `filterNeeded`
- `filter_needed`
- `Filter Required`

### Filter Installed
- `Filter Installed`
- `filterInstalledOn`
- `filter_installed_on`
- `Filter Installed On`

### Filters On
- `Filters On`
- `filtersOn`
- `filters_on`
- `Filter Status`

### Asset Type
- `Asset Type`
- `assetType`
- `asset_type`
- `Type`
- `type`

## Business Logic

### Complete Filter Logic Rules

The API implements comprehensive filter state management with the following priority rules:

#### 1. Filter Installed Present & Valid
- **Condition**: `filterInstalledOn` has valid date
- **Result**:
  - `filterNeeded = TRUE`
  - `filtersOn = TRUE`
  - `filterExpiry = filterInstalledOn + 3 months`

#### 2. Filter Installed Missing/Invalid
- **Condition**: `filterInstalledOn` is empty or invalid date
- **Result**:
  - `filterNeeded = FALSE`
  - `filtersOn = FALSE`
  - `filterExpiry = undefined`
  - `filterInstalledOn = undefined`

#### 3. Filters On = 'NO' Override
- **Condition**: `filtersOn` explicitly set to 'NO'
- **Result**:
  - Forces `filtersOn = FALSE`
  - Clears `filterInstalledOn` and `filterExpiry`
  - Retains `filterNeeded` value if provided

#### 4. Validation Check
- **Error**: If `filterNeeded = YES` but `filterInstalledOn` missing
- **Message**: `"Row X: Filter Installed Date is required if Filter Needed is YES"`

### Asset Type Auto-Creation
- If `Asset Type` is provided and doesn't exist in database
- Automatically creates new asset type entry
- Available immediately for future uploads

### Duplicate Prevention
- Case-insensitive barcode checking
- Checks against existing database assets
- Prevents duplicates within same upload batch

## Response Format

### Success Response
```json
{
  "success": true,
  "results": {
    "total": 5,
    "uploaded": 4,
    "failed": 1,
    "errors": [
      "Row 3: Asset Barcode is required"
    ]
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "No file uploaded"
}
```

## Sample CSV Format

```csv
Asset Barcode,Location,Filter Needed,Filter Installed,Filters On,Asset Type
F001,Room 301,YES,2024-10-01,,Water Tap
F002,Room 302,NO,,,Water Cooler
F003,Room 303,,2024-09-15,,LNS Outlet - TMT
F004,Kitchen Area,YES,,NO,Coffee Machine Filter
F005,Lab 101,YES,2024-10-10,YES,Equipment Stand
```

### Filter Logic Examples
- **F001**: Has install date → `filterNeeded=TRUE, filtersOn=TRUE, expiry=2025-01-01`
- **F002**: No install date → `filterNeeded=FALSE, filtersOn=FALSE`  
- **F003**: Has install date (no filter needed specified) → `filterNeeded=TRUE, filtersOn=TRUE`
- **F004**: `filtersOn=NO` override → `filterNeeded=TRUE, filtersOn=FALSE, cleared dates`
- **F005**: All fields consistent → `filterNeeded=TRUE, filtersOn=TRUE, expiry calculated`

## Error Handling

### Validation Errors
- Missing required fields
- Invalid date formats
- Duplicate barcodes
- Empty file content

### Row-Level Errors
- Each error includes row number for easy identification
- Up to 20 errors returned per upload
- Processing continues for valid rows even if some fail

## Excel Date Handling

### Automatic Conversion
- Excel date serial numbers automatically converted
- Supports various date formats:
  - YYYY-MM-DD
  - MM/DD/YYYY
  - DD/MM/YYYY
  - Excel serial numbers

## Database Integration

### Tables Used
- **Assets Table**: `water-tap-assets`
- **Asset Types Table**: `AssetTypes`

### Generated Fields
- `id`: Auto-generated unique identifier
- `created`: Upload timestamp
- `createdBy`: Set to 'csv-upload'
- `modified`: Upload timestamp
- `modifiedBy`: Set to 'csv-upload'
- `status`: Defaults to 'ACTIVE'
- `filtersOn`: Defaults to false

## Usage Examples

### JavaScript Fetch
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/csv-upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Upload results:', result);
```

### cURL
```bash
curl -X POST \
  -F "file=@assets.csv" \
  https://your-domain.com/api/csv-upload
```

## Best Practices

1. **File Preparation**
   - Use the required headers exactly as specified
   - Ensure Asset Barcodes are unique
   - Use consistent date formats

2. **Error Handling**
   - Check the response for failed uploads
   - Review error messages for specific issues
   - Fix data and re-upload failed rows

3. **Large Files**
   - Process in smaller batches for better performance
   - Monitor upload results for any failures

4. **Data Validation**
   - Validate data before upload
   - Use YES/NO for Filter Needed field
   - Ensure dates are in recognizable formats 