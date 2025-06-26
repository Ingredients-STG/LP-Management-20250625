# Water Tap Asset Management System

A comprehensive web application for managing water tap assets, drinking fountains, and water outlets using AWS services including Lambda, DynamoDB, API Gateway, and Amplify.

## 🚰 Features

- **Asset Management**: Track water taps, drinking fountains, LNS outlets, water coolers, and other water assets
- **22-Field Asset Schema**: Comprehensive tracking with barcode, status, type, location, and maintenance details
- **Location Management**: Organize assets by wing, room, floor with detailed location information
- **Filter Management**: Track filter needs, installation dates, expiry dates, and filter status
- **Status Tracking**: Monitor asset status (Active, Inactive, Maintenance, Decommissioned)
- **Dashboard Analytics**: Real-time insights into asset distribution, status breakdown, and filter requirements
- **Bulk Import/Export**: Excel-based data management with standardized template
- **Search & Filter**: Advanced search functionality across all asset fields
- **Real-time Updates**: Live data synchronization with instant updates

## 🏗️ Architecture

- **Frontend**: Modern HTML5, CSS3 (Tailwind CSS), Vanilla JavaScript (ES6+)
- **Backend**: AWS Lambda (Node.js 18+)
- **Database**: Amazon DynamoDB
- **API**: Amazon API Gateway (REST API with CORS)
- **Hosting**: AWS Amplify
- **Deployment**: GitHub + AWS Amplify CI/CD pipeline

## 📋 Current Asset Schema (22 Fields)

The system uses a comprehensive 22-field schema for complete asset tracking:

```javascript
{
  // Core Asset Information
  id: "uuid-v4-string",                    // Auto-generated UUID
  assetBarcode: "b30674",                  // Unique asset identifier (Required)
  status: "ACTIVE",                        // ACTIVE|INACTIVE|MAINTENANCE|DECOMMISSIONED (Required)
  assetType: "Water Tap",                  // Asset type classification (Required)
  
  // Identifiers
  primaryIdentifier: "gah",                // Primary asset identifier (Required)
  secondaryIdentifier: "SEC-001",          // Optional secondary identifier
  
  // Location Information
  wing: "North Wing",                      // Building wing/section
  wingInShort: "N",                       // Wing abbreviation (N, S, E, W)
  room: "112",                            // Room identifier
  floor: "1",                             // Floor number/identifier
  floorInWords: "Ground Floor",           // Floor description
  roomNo: "112",                          // Room number
  roomName: "Reception Area",             // Room name/description
  
  // Filter Management
  filterNeeded: true,                     // Boolean - Does asset need filters? (Required)
  filtersOn: false,                       // Boolean - Are filters currently active? (Required)
  filterExpiryDate: "31/12/2024",        // Filter expiry date (dd/mm/yyyy format)
  filterInstalledOn: "15/01/2024",       // Filter installation date (dd/mm/yyyy format)
  
  // Additional Information
  notes: "Regular maintenance required",   // Free text notes/comments
  augmentedCare: false,                   // Boolean - Special care requirements (Required)
  
  // System Fields (Auto-managed)
  created: "2024-01-01T10:00:00.000Z",   // ISO timestamp - creation date
  createdBy: "User",                      // User who created the record
  modified: "2024-01-01T10:00:00.000Z",  // ISO timestamp - last modification
  modifiedBy: "User"                      // User who last modified the record
}
```

## 🚀 API Endpoints

**Base URL**: `https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev/items`

### Assets
- `GET /assets` - List all assets (returns 10 assets currently)
- `POST /assets` - Create new asset
- `PUT /assets/{id}` - Update existing asset
- `DELETE /assets/{id}` - Delete asset

### Dashboard
- `GET /dashboard` - Get dashboard analytics and statistics

### Future Endpoints
- `GET /locations` - List all locations
- `GET /maintenance` - List maintenance records

## 🛠️ Setup Instructions

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- Git installed

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ingredients-STG/LP-Management-20250625.git
   cd "LP Management"
   ```

2. **Install Lambda dependencies**
   ```bash
   cd lambda-function
   npm install
   cd ..
   ```

3. **Configure API endpoint**
   - The API endpoint is already configured in `src/app.js`
   - Current endpoint: `https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev/items`

4. **Test locally**
   ```bash
   # Serve the frontend locally
   cd src
   python -m http.server 8000
   # Or use any local server
   ```

5. **Access the application**
   - Open http://localhost:8000 in your browser

### AWS Deployment

The system is configured for automatic deployment:

1. **Push changes to GitHub**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. **Automatic deployment**
   - Frontend automatically deploys via AWS Amplify
   - Lambda function updates manually via AWS CLI:
   ```bash
   cd lambda-function
   zip -r ../lambda-function.zip .
   cd ..
   aws lambda update-function-code --function-name water-tap-asset-lambda --region eu-west-2 --zip-file fileb://lambda-function.zip
   ```

## 📊 Database Configuration

### DynamoDB Table: WaterTapAssetAssets
- **Table Name**: `WaterTapAssetAssets`
- **Primary Key**: `id` (String)
- **Region**: `eu-west-2`
- **Current Records**: 10 assets with mixed legacy and new field structures

### Data Migration Status
- ✅ **Status normalization**: All status values converted to UPPERCASE
- ✅ **Field compatibility**: System handles both old and new field structures
- ✅ **Date formatting**: Unified date format (dd/mm/yyyy for dates, dd/mm/yyyy hh:mm for timestamps)
- ✅ **Boolean handling**: Consistent true/false values with "Yes"/"No" display

## 🔐 Security & CORS

### CORS Configuration
- **Allowed Origin**: `https://main.d25j5qt77sjegi.amplifyapp.com`
- **Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Requested-With, X-Amz-Date, X-Api-Key, X-Amz-Security-Token

### Authentication
- Currently using AWS IAM for API Gateway access
- Lambda function has appropriate DynamoDB permissions

## 🎨 UI Features

### Dashboard
- **Total Assets**: Shows count of all assets (currently 10)
- **Active Assets**: Count of assets with ACTIVE status (currently 9)
- **Maintenance**: Count of assets requiring maintenance (currently 0)
- **Filters Needed**: Count of assets needing filter replacement (currently 8)

### Asset Table
- **22 columns**: All asset fields displayed in organized table
- **Status indicators**: Color-coded status badges (green for ACTIVE, etc.)
- **Boolean displays**: Yes/No badges with color coding
- **Date formatting**: Consistent dd/mm/yyyy display format
- **Action buttons**: Edit and delete buttons for each asset

### Asset Form
- **Comprehensive form**: All 22 fields with appropriate input types
- **Validation**: Required field validation for core fields
- **Status dropdown**: ACTIVE, INACTIVE, MAINTENANCE, DECOMMISSIONED options
- **Boolean selectors**: Yes/No dropdowns for filter and care fields
- **Date pickers**: Proper date input fields for filter dates

### Search & Filter
- **Global search**: Search across all text fields
- **Real-time filtering**: Instant results as you type
- **Field coverage**: Searches barcode, status, type, identifiers, location, notes, and user fields

## 📱 Mobile Support

- **Responsive design**: Mobile-first approach with Tailwind CSS
- **Touch-friendly**: Optimized for tablet and mobile interaction
- **Horizontal scrolling**: Table scrolls horizontally on smaller screens
- **Modal forms**: Full-screen modals on mobile devices

## 🔧 Configuration Files

### Frontend Configuration (`src/app.js`)
```javascript
const API_BASE_URL = 'https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev/items';
```

### Lambda Configuration (`lambda-function/index.js`)
```javascript
const ASSETS_TABLE = 'WaterTapAssetAssets';
const MAINTENANCE_TABLE = 'WaterTapMaintenance';
const LOCATIONS_TABLE = 'WaterTapLocations';
```

## 📈 Current System Status

### ✅ Working Features
- **Asset Loading**: All 10 assets load correctly
- **Create Assets**: New asset creation with UUID generation
- **Update Assets**: Edit existing assets with proper validation
- **Delete Assets**: Remove assets from database
- **Dashboard Analytics**: Real-time statistics and breakdowns
- **Search Functionality**: Filter assets by any field
- **Status Management**: Normalized UPPERCASE status values
- **CORS Handling**: Proper cross-origin request support

### 🔧 Recent Fixes Applied
- **API URL corrections**: Fixed duplicate /items prefix issues
- **Path parameter extraction**: Added fallback for asset ID extraction
- **Status normalization**: Unified all status values to UPPERCASE
- **Search clearing**: Auto-clear search when loading assets
- **Date formatting**: Consistent dd/mm/yyyy format across system
- **Boolean handling**: Proper true/false handling with display formatting

## 📋 Excel Template Format

For bulk upload, the Excel template includes these columns in exact order:

1. **assetBarcode** (Required) - Unique identifier
2. **status** - ACTIVE, INACTIVE, MAINTENANCE, DECOMMISSIONED
3. **assetType** (Required) - Water Tap, LNS Outlet, Water Cooler, etc.
4. **primaryIdentifier** (Required) - Primary asset ID
5. **secondaryIdentifier** - Secondary ID (optional)
6. **wing** - Building wing/section
7. **wingInShort** - Wing abbreviation
8. **room** - Room identifier
9. **floor** - Floor number
10. **floorInWords** - Floor description
11. **roomNo** - Room number
12. **roomName** - Room name
13. **filterNeeded** (Required) - true/false
14. **filtersOn** (Required) - true/false
15. **filterExpiryDate** - dd/mm/yyyy format
16. **filterInstalledOn** - dd/mm/yyyy format
17. **notes** - Free text
18. **augmentedCare** (Required) - true/false

*System fields (created, createdBy, modified, modifiedBy) are auto-generated*

## 🚀 Deployment URLs

- **Production Site**: https://main.d25j5qt77sjegi.amplifyapp.com
- **API Gateway**: https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev
- **GitHub Repository**: https://github.com/Ingredients-STG/LP-Management-20250625

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make your changes
4. Test thoroughly (both frontend and API)
5. Commit changes (`git commit -m 'Add new feature'`)
6. Push to branch (`git push origin feature/new-feature`)
7. Create Pull Request

## 🆘 Troubleshooting

### Common Issues

1. **"Not found" errors when editing**
   - ✅ **RESOLVED**: Lambda function now properly extracts asset IDs from URL paths

2. **CORS errors**
   - ✅ **RESOLVED**: Proper CORS headers configured for production domain

3. **Only showing 2 assets instead of 10**
   - ✅ **RESOLVED**: Search clearing implemented to show all assets

4. **Status display inconsistencies**
   - ✅ **RESOLVED**: All status values normalized to UPPERCASE

### Debug Steps
1. Check browser console for JavaScript errors
2. Verify API endpoint in `src/app.js`
3. Check AWS CloudWatch logs for Lambda errors
4. Verify DynamoDB table permissions

## 📄 License

This project is licensed under the ISC License.

## 🔄 Version History

### v3.0.0 - Current Production Version (December 2024)
- ✅ **Complete system overhaul**: New 22-field schema implementation
- ✅ **CRUD operations**: Full Create, Read, Update, Delete functionality
- ✅ **Status normalization**: UPPERCASE status values throughout
- ✅ **API fixes**: Resolved path parameter and CORS issues
- ✅ **Search improvements**: Auto-clearing and comprehensive field coverage
- ✅ **UI enhancements**: Responsive design with proper data formatting
- ✅ **Production deployment**: Live system with 10 active assets

### v2.0.0 - Schema Migration
- Updated to 22-field asset schema
- Enhanced location tracking
- Improved filter management

### v1.0.0 - Initial Release
- Basic asset management functionality
- Legacy schema support 