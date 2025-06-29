#!/bin/bash

echo "🌊 Starting AquaTrack Pro - Water Tap Management System"
echo "========================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🚀 Starting development server..."
echo "💡 The application will be available at: http://localhost:3000"
echo "📱 Network access available at: http://192.168.8.200:3000"
echo ""
echo "🎯 Features available:"
echo "   • Dashboard with real-time statistics"
echo "   • Asset management with CRUD operations"
echo "   • Advanced filtering and search"
echo "   • Data export functionality"
echo "   • Professional charts and analytics"
echo "   • Responsive design for all devices"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================================="

npm run dev 