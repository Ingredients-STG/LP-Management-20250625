#!/bin/bash

# Configure Amplify App with the new IAM role
echo "⚙️ Configuring Amplify app with IAM role..."

APP_ID="d25j5qt77sjegi"
ROLE_ARN="arn:aws:iam::393157401543:role/AmplifyServiceRole-WaterTapAssets"
REGION="eu-west-2"

# Update the Amplify app with the service role
echo "🔧 Setting service role for Amplify app..."
aws amplify update-app \
    --app-id $APP_ID \
    --iam-service-role-arn $ROLE_ARN \
    --region $REGION

echo "✅ Amplify app configured with IAM role!"
echo ""
echo "📝 Next steps:"
echo "1. The app should now have the proper permissions"
echo "2. Go to Amplify Console to trigger a redeploy:"
echo "   https://eu-west-2.console.aws.amazon.com/amplify/home?region=eu-west-2#/d25j5qt77sjegi"
echo "3. Click on 'Hosting' → 'main' branch"
echo "4. Click 'Redeploy this version'"
echo ""
echo "🎯 Or trigger deployment via CLI:"
echo "   aws amplify start-deployment --app-id $APP_ID --branch-name main --region $REGION" 