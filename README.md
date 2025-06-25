# Water Tap Asset Management System

A comprehensive web application for managing water tap assets using AWS services including Lambda, DynamoDB, API Gateway, and Amplify.

## 🚰 Features

- **Asset Management**: Track water taps, drinking fountains, and water coolers
- **Maintenance Scheduling**: Schedule and track maintenance activities
- **Location Management**: Organize assets by building, floor, and room
- **Filter Tracking**: Monitor filter replacement needs and schedules
- **Dashboard Analytics**: Visual insights into asset status and distribution
- **Real-time Updates**: Live data synchronization across all devices

## 🏗️ Architecture

- **Frontend**: Modern HTML5, CSS3 (Tailwind), JavaScript (ES6+)
- **Backend**: AWS Lambda (Node.js)
- **Database**: Amazon DynamoDB
- **API**: Amazon API Gateway (REST API)
- **Hosting**: AWS Amplify
- **Authentication**: AWS IAM
- **Deployment**: AWS CloudFormation

## 📋 Asset Schema

Based on your water tap asset data structure:

```javascript
{
  id: "unique-id",
  assetBarcode: "WT001",
  status: "ACTIVE|INACTIVE|MAINTENANCE|RETIRED",
  assetType: "Water Tap|Drinking Fountain|Water Cooler",
  primaryIdentifier: "Main Hall Tap",
  secondaryIdentifier: "Optional secondary ID",
  value: 150.00,
  wireToShort: "Connection info",
  wireToShortValue: 25.5,
  floor: "Ground",
  floorInWords: "Ground Floor",
  room: "Main Hall",
  roomOffice: "Reception Area",
  filterNeeded: true,
  filtersOn: "Active filters",
  filterExpiry: "2024-12-31",
  filterExpiredDate: "2024-01-15",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z"
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
   git commit -m "Initial commit"
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
- **Attributes**: All asset properties as defined in schema

### Maintenance Table
- **Primary Key**: `id` (String)
- **Global Secondary Index**: `assetId-index`
- **Attributes**: Maintenance record properties

### Locations Table
- **Primary Key**: `id` (String)
- **Attributes**: Building, floor, room information

## 🔐 Security

- **IAM Roles**: Properly configured Lambda execution roles
- **API Gateway**: CORS enabled for cross-origin requests
- **DynamoDB**: Fine-grained access control
- **Amplify**: Secure hosting with HTTPS

## 🎨 UI Components

- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Interactive Dashboard**: Real-time stats and charts
- **Modal Forms**: User-friendly asset creation/editing
- **Data Tables**: Sortable and filterable asset lists
- **Status Indicators**: Visual status badges and icons

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

- **v1.0.0** - Initial release with core asset management features
- **v1.1.0** - Added maintenance scheduling
- **v1.2.0** - Enhanced dashboard analytics

---

Built with ❤️ using AWS Amplify and modern web technologies. 