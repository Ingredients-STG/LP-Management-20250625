#!/bin/bash

# Simple Cron Job Setup for LP Management Email Reports
# This script sets up a local cron job to trigger email reports

echo "🚀 Setting up cron job for LP Management Email Reports..."

# Configuration
APP_URL="http://localhost:3000"  # Change to your production URL
SCRIPT_PATH="$(pwd)/cron-scheduler.js"

echo "📋 Configuration:"
echo "  App URL: $APP_URL"
echo "  Script Path: $SCRIPT_PATH"

# 1. Make the cron script executable
echo "🔧 Making cron script executable..."
chmod +x cron-scheduler.js

# 2. Update the script with the correct URL
echo "📝 Updating script with correct URL..."
sed -i.bak "s|const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';|const API_BASE_URL = process.env.API_BASE_URL || '$APP_URL';|g" cron-scheduler.js

# 3. Test the script
echo "🧪 Testing the script..."
node cron-scheduler.js

if [ $? -eq 0 ]; then
    echo "✅ Script test successful!"
    
    # 4. Add to crontab
    echo "📅 Adding to crontab..."
    (crontab -l 2>/dev/null; echo "# LP Management Email Reports Scheduler - runs every hour"; echo "0 * * * * $SCRIPT_PATH") | crontab -
    
    echo "✅ Cron job added successfully!"
    echo ""
    echo "📋 Current crontab:"
    crontab -l | grep -A 2 -B 2 "LP Management"
    echo ""
    echo "🧪 To test manually:"
    echo "node $SCRIPT_PATH"
    echo ""
    echo "📊 To check cron logs:"
    echo "grep CRON /var/log/syslog"
else
    echo "❌ Script test failed. Please check the configuration."
    exit 1
fi
