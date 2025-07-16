# Water Tap Asset Management System

A modern, robust water tap asset management system built with **Next.js 14**, **TypeScript**, and **Tailwind CSS**.

---

## 🚀 Features

- **Modern Stack**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Robust Components**: Built with Radix UI primitives and custom components
- **Real-time Dashboard**: Comprehensive analytics and statistics
- **Asset Management**: Full CRUD operations for water tap assets
- **Bulk Operations**: Excel import/export functionality
- **Responsive Design**: Mobile-first approach with beautiful UI
- **Type Safety**: Full TypeScript coverage
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Performance**: Optimized with React hooks and modern patterns

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + Custom Components
- **State Management**: React Hooks + Custom Hooks
- **Forms**: React Hook Form + Zod Validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Date Handling**: date-fns
- **File Processing**: XLSX

## 📦 Installation

1. **Clone and Navigate**:
   ```bash
   git clone <your-repo-url>
   cd LP\ Management
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev
   NEXT_PUBLIC_APP_NAME="Water Tap Asset Management System"
   NEXT_PUBLIC_APP_VERSION="3.0.0"
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Open Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API route handlers
│   ├── globals.css         # Global styles and CSS variables
│   ├── layout.tsx          # Root layout
│   ├── login/              # Login page
│   └── page.tsx            # Main application page
├── components/             # React components
│   ├── ui/                 # Reusable UI components
│   ├── BarcodeScanner.tsx  # Barcode scanner component
│   └── ProtectedRoute.tsx  # Route protection
├── contexts/               # React context providers
│   └── AuthContext.tsx     # Authentication context
├── lib/                    # Utility libraries
│   ├── cognito.ts          # Cognito integration
│   ├── dynamodb.ts         # DynamoDB integration
│   ├── filterLogic.ts      # Filter logic utilities
│   └── utils.ts            # General utilities
```

> **Note:** Sample files and backup files (e.g., `sample_csv_upload.csv`, `sample_bulk_upload.csv`, `page.tsx.bak`) have been removed for a cleaner project. Please avoid adding unnecessary files to keep the repository tidy.

## 🎯 Key Components

### Dashboard
- **Real-time Statistics**: Total assets, active assets, maintenance status
- **Filter Management**: Track filter status and expiry dates
- **Visual Breakdowns**: Status, asset type, and wing distributions
- **Responsive Design**: Works seamlessly on all devices

### Asset Management
- **CRUD Operations**: Create, read, update, delete assets
- **Form Validation**: Comprehensive validation with TypeScript
- **Search & Filter**: Advanced search across all asset fields
- **Bulk Operations**: Import/export via Excel files

### API Integration
- **Type-safe API**: Full TypeScript coverage for API calls
- **Error Handling**: Robust error handling with user feedback
- **Loading States**: Proper loading indicators
- **Retry Logic**: Automatic retry for failed requests

## 🔧 Asset Schema

The system uses a comprehensive 22-field asset schema:

```typescript
interface Asset {
  id: string;
  assetBarcode: string;      // Unique identifier
  assetType: string;         // Type of water asset
  status: AssetStatus;       // ACTIVE | INACTIVE | MAINTENANCE | DECOMMISSIONED
  primaryIdentifier: string; // Primary characteristic
  secondaryIdentifier?: string;
  wing: string;             // Building wing
  wingInShort?: string;
  room?: string;
  floor?: string;
  floorInWords?: string;
  roomNo?: string;
  roomName?: string;
  filterNeeded: boolean;
  filtersOn: boolean;
  filterExpiryDate?: string;
  filterInstalledOn?: string;
  notes?: string;
  augmentedCare: boolean;
  created: string;
  createdBy?: string;
  modified: string;
  modifiedBy?: string;
}
```

## 🚀 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

### Code Quality

- **ESLint**: Configured with Next.js recommended rules
- **TypeScript**: Strict mode enabled
- **Prettier**: Code formatting (if configured)
- **Tailwind CSS**: Utility-first styling

## 🔄 API Integration

The system connects to your existing AWS Lambda API:
- **Endpoint**: `https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev`
- **Authentication**: None required (as per current setup)
- **CORS**: Properly configured for cross-origin requests

### API Endpoints Used:
- `GET /dashboard` - Dashboard statistics
- `GET /assets` - List all assets
- `POST /assets` - Create new asset
- `PUT /assets/{id}` - Update asset
- `DELETE /assets/{id}` - Delete asset

## 🎨 Design System

The application uses a comprehensive design system:

- **Colors**: HSL-based color system with CSS variables
- **Typography**: Inter font family
- **Spacing**: Consistent spacing scale
- **Components**: Reusable, accessible components
- **Dark Mode**: Ready for dark mode implementation

## 📱 Responsive Design

- **Mobile First**: Designed for mobile devices first
- **Breakpoints**: Responsive across all screen sizes
- **Touch Friendly**: Optimized for touch interactions
- **Accessibility**: WCAG compliant components

## 🔒 Type Safety

Full TypeScript coverage ensures:
- **Compile-time Checks**: Catch errors before runtime
- **IntelliSense**: Better developer experience
- **Refactoring Safety**: Safe code refactoring
- **API Contracts**: Type-safe API interactions

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Deployment Options

1. **AWS Amplify (Auto-Deploy)**
   - This project is set up to automatically deploy to AWS Amplify when changes are pushed to the `main` branch.
   - AWS credentials and GitHub are already connected for this workflow.
   - No manual deployment steps are required unless you wish to trigger a redeploy.

2. **Vercel** (Alternative):
   ```bash
   npx vercel
   ```

3. **Netlify** (Alternative):
   ```bash
   npm run build
   # Deploy the output folder
   ```

## 🔧 Configuration

### Environment Variables

```env
# Required
NEXT_PUBLIC_API_BASE_URL=your-api-endpoint

# Optional
NEXT_PUBLIC_APP_NAME="Your App Name"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

### Customization

1. **Colors**: Modify CSS variables in `globals.css`
2. **Components**: Extend components in `components/ui/`
3. **API**: Update endpoints in `src/lib/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the code comments
- Open an issue on GitHub

---

**Built with ❤️ using Next.js 14 and TypeScript**
