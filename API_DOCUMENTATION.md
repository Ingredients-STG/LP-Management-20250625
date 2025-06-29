# Water Tap Management API Documentation

## Base URL
```
https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev
```

## Available Endpoints

### 1. Assets Endpoint
**GET** `/assets`

Returns a comprehensive list of all water tap assets with detailed information.

**Response Structure:**
```json
{
  "items": [...],     // Array of asset objects (primary)
  "assets": [...],    // Array of asset objects (duplicate)
  "count": 10         // Total number of assets
}
```

**Asset Object Structure:**
```json
{
  "id": "string",
  "assetBarcode": "string",
  "status": "ACTIVE|INACTIVE|MAINTENANCE",
  "assetType": "string",
  "primaryIdentifier": "string",
  "secondaryIdentifier": "string",
  "wing": "string",
  "wingInShort": "string",
  "room": "string",
  "floor": "string",
  "floorInWords": "string",
  "roomNo": "string",
  "roomName": "string",
  "filterNeeded": boolean,
  "filtersOn": boolean,
  "filterExpiryDate": "YYYY-MM-DD",
  "filterInstalledOn": "YYYY-MM-DD",
  "notes": "string",
  "augmentedCare": boolean,
  "created": "ISO 8601 timestamp",
  "createdBy": "string",
  "modified": "ISO 8601 timestamp",
  "modifiedBy": "string"
}
```

### 2. Dashboard Endpoint
**GET** `/dashboard`

Returns aggregated statistics and breakdowns for dashboard display.

**Response Structure:**
```json
{
  "totalAssets": 10,
  "activeAssets": 10,
  "maintenanceAssets": 0,
  "filtersNeeded": 9,
  "statusBreakdown": {
    "ACTIVE": 10
  },
  "assetTypeBreakdown": {
    "LNS Outlet - TMT": 3,
    "LNS Shower - TMT": 2,
    "Water Tap": 4,
    "Water Cooler": 1
  },
  "wingBreakdown": {
    "Las": 1,
    "Unknown": 6,
    "Test Wing": 1,
    "North Wing": 2
  },
  "filterStatus": {
    "filtersOn": 5,
    "filtersNeeded": 9,
    "augmentedCare": 2
  }
}
```

## Authentication
- Root endpoint (`/`) requires authentication token
- `/assets` and `/dashboard` endpoints are publicly accessible

## Error Responses
```json
{
  "error": "Not found"
}
```

```json
{
  "message": "Missing Authentication Token"
}
```

## Next.js Proxy API
Our application uses a proxy API to avoid CORS issues:

**Local Endpoints:**
- `GET /api/proxy?endpoint=assets` - Proxies to `/assets`
- `GET /api/proxy?endpoint=dashboard` - Proxies to `/dashboard`

**Proxy Response Format:**
```json
{
  "success": true,
  "data": {...},           // Original API response
  "timestamp": "ISO 8601"
}
```

## Asset Types Found
- LNS Outlet - TMT
- LNS Shower - TMT  
- Water Tap
- Water Cooler

## Status Values
- ACTIVE
- INACTIVE
- MAINTENANCE

## Wing Classifications
- Las (LNS)
- North Wing (N/NW)
- Test Wing
- Unknown (empty wing field)

## Filter Information
- `filterNeeded`: Boolean indicating if filter replacement is needed
- `filtersOn`: Boolean/string indicating if filters are currently installed
- `filterExpiryDate`: Date when current filter expires
- `filterInstalledOn`: Date when filter was installed
- `augmentedCare`: Boolean for special care requirements

## Usage Examples

### Fetch All Assets
```javascript
const response = await fetch('/api/proxy?endpoint=assets');
const data = await response.json();
const assets = data.data.items || data.data.assets || [];
```

### Fetch Dashboard Stats
```javascript
const response = await fetch('/api/proxy?endpoint=dashboard');
const data = await response.json();
const stats = data.data;
```

## Current Data Summary
- **Total Assets**: 10
- **Active Assets**: 10  
- **Filters Needed**: 9
- **Asset Types**: 4 different types
- **Wings**: 4 different wings/locations
- **Last Updated**: Assets have timestamps from June 2025 