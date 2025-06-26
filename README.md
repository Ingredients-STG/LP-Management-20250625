# Water Tap Asset Management System

A comprehensive web application for managing water tap assets using AWS services including Lambda, DynamoDB, API Gateway, and Amplify.

## 🚰 Features

- **Asset Management**: Track water outlets, taps, drinking fountains, and water coolers
- **Outlet Type Classification**: Wall Mounted, Floor Standing, Countertop, and more
- **Tap Type Tracking**: Push Button, Sensor, Lever, Turn Handle systems
- **Location Management**: Organize assets by wing, building code, room ID, and floor details
- **Filter Tracking**: Monitor filter installation, expiry dates, and maintenance needs
- **Usage Status**: Track which assets are currently in use
- **Dashboard Analytics**: Visual insights into asset status and distribution
- **Bulk Import/Export**: Excel-based data management with template download
- **Real-time Updates**: Live data synchronization across all devices

## 🏗️ Architecture

- **Frontend**: Modern HTML5, CSS3 (Tailwind), JavaScript (ES6+)
- **Backend**: AWS Lambda (Node.js)
- **Database**: Amazon DynamoDB
- **API**: Amazon API Gateway (REST API)
- **Hosting**: AWS Amplify
- **Authentication**: AWS IAM
- **Deployment**: AWS CloudFormation

## 📋 New Asset Schema (22 Fields)

Based on the updated water tap asset data structure:

```javascript
{
  id: "unique-id",
  assetBarcode: "WT001",
  status: "ACTIVE|INACTIVE|MAINTENANCE|DECOMMISSIONED",
  outletType: "Wall Mounted|Floor Standing|Countertop|Drinking Fountain|Water Cooler",
  tapType: "Push Button|Sensor|Lever|Turn Handle",
  spareColumn: "Reserved for future use",
  wing: "North Wing",
  buildingCode: "B001",
  roomId: "R101",
  floorNumber: 1,
  floorName: "Ground Floor",
  roomNumber: "101",
  roomName: "Reception",
  hasFilter: true,
  filterNeeded: false,
  filterExpiryDate: "2024-12-31",
  filterInstalledDate: "2024-01-15",
  maintenanceNotes: "Regular maintenance required",
  inUse: true,
  createdAt: "2024-01-01T00:00:00Z",
  createdBy: "Admin",
  modifiedAt: "2024-01-01T00:00:00Z",
  modifiedBy: "Admin"
}
```

## 🚀 API Endpoints

### Assets
- `GET /items/assets` - List all assets
- `GET /items/assets/{id}` - Get specific asset
- `POST /items/assets` - Create new asset
- `PUT /items/assets/{id}` - Update asset
- `DELETE /items/assets/{id}` - Delete asset

### Maintenance
- `GET /items/maintenance` - List maintenance records
- `POST /items/maintenance` - Create maintenance record
- `PUT /items/maintenance/{id}` - Update maintenance record

### Locations
- `GET /items/locations` - List all locations
- `POST /items/locations` - Create new location

### Dashboard
- `GET /items/dashboard` - Get dashboard analytics

## 🛠️ Setup Instructions

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- Amplify CLI installed

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ingredients-STG/LP-Management-20250625.git
   cd LP-Management-20250625
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize Amplify (if not already done)**
   ```bash
   amplify init
   ```

4. **Deploy backend resources**
   ```bash
   amplify push
   ```

5. **Update API endpoint**
   - After deployment, update the `API_BASE_URL` in `src/app.js` with your actual API Gateway URL

6. **Test locally**
   - Open `src/index.html` in a web browser
   - Or use a local server: `python -m http.server 8000` (from src directory)

### AWS Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Full schema reset & cleanup"
   git push origin main
   ```

2. **Deploy with Amplify Console**
   ```bash
   amplify publish
   ```

## 📊 Database Tables

### Assets Table
- **Primary Key**: `id` (String)
- **Global Secondary Index**: `assetBarcode-index`
- **Attributes**: All 22 asset properties as defined in new schema

### Maintenance Table
- **Primary Key**: `id` (String)
- **Global Secondary Index**: `assetId-index`
- **Attributes**: Maintenance record properties

### Locations Table
- **Primary Key**: `id` (String)
- **Attributes**: Wing, building code, floor, and room information

## 🔐 Security

- **IAM Roles**: Properly configured Lambda execution roles
- **API Gateway**: CORS enabled for cross-origin requests
- **DynamoDB**: Fine-grained access control
- **Amplify**: Secure hosting with HTTPS

## 🎨 UI Components

- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Interactive Dashboard**: Real-time stats and charts
- **Modal Forms**: User-friendly asset creation/editing with 22 fields
- **Data Tables**: Sortable and filterable asset lists (21 visible columns)
- **Status Indicators**: Visual status badges and icons
- **Bulk Upload**: Excel template with all 22 fields

## 📱 Mobile Support

- Fully responsive design
- Touch-friendly interface
- Optimized for tablets and smartphones
- Progressive Web App (PWA) ready

## 🔧 Configuration

### Environment Variables
- `ASSETS_TABLE`: DynamoDB table name for assets
- `MAINTENANCE_TABLE`: DynamoDB table name for maintenance
- `LOCATIONS_TABLE`: DynamoDB table name for locations

### API Configuration
Update `src/app.js` with your deployed API Gateway URL:
```javascript
const API_BASE_URL = 'https://your-api-id.execute-api.eu-west-2.amazonaws.com/dev';
```

## 📈 Monitoring

- **CloudWatch Logs**: Lambda function logs
- **CloudWatch Metrics**: API Gateway and DynamoDB metrics
- **X-Ray Tracing**: Request tracing for debugging
- **Amplify Console**: Deployment and hosting metrics

## 📋 Excel Template Format

The bulk upload template includes these columns in order:
1. Asset Barcode (Required)
2. Status
3. Outlet Type (Required)
4. Tap Type (Required)
5. Wing
6. Building Code
7. Room ID
8. Floor Number
9. Floor Name
10. Room Number
11. Room Name
12. Has Filter (true/false)
13. Filter Needed (true/false)
14. Filter Expiry Date (YYYY-MM-DD)
15. Filter Installed Date (YYYY-MM-DD)
16. Maintenance Notes
17. In Use (true/false)
18. Created By
19. Modified By

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Contact: [Your contact information]

## 🔄 Version History

### v2.0.0 - Full Schema Reset
- Complete rebuild with new 22-field asset schema
- Updated outlet type and tap type classification
- Enhanced location tracking with building codes and room IDs
- Improved filter management system
- Updated bulk import/export functionality
- Modernized UI components and dashboard

### v1.0.0 - Initial Release
- Basic asset management functionality
- Legacy schema with 22 fields 