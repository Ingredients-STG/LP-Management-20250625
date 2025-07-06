#!/bin/bash

# LP Management - Manual Cognito Setup for eu-west-2
echo "Setting up Cognito in eu-west-2 region..."

# Step 1: Create User Pool
echo "Creating User Pool..."
USER_POOL_OUTPUT=$(aws cognito-idp create-user-pool \
  --pool-name "LP-Management-Users-EU" \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --auto-verified-attributes email \
  --username-attributes email \
  --verification-message-template "DefaultEmailOption=CONFIRM_WITH_CODE" \
  --mfa-configuration OFF \
  --account-recovery-setting "RecoveryMechanisms=[{Name=verified_email,Priority=1}]" \
  --admin-create-user-config "AllowAdminCreateUserOnly=false" \
  --user-pool-tags "Project=LP-Management,Environment=Production" \
  --region eu-west-2 \
  --output json)

USER_POOL_ID=$(echo "$USER_POOL_OUTPUT" | grep '"Id"' | cut -d'"' -f4)
echo "User Pool ID: $USER_POOL_ID"

# Step 2: Create User Pool Client
echo "Creating User Pool Client..."
CLIENT_OUTPUT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-name "LP-Management-Client" \
  --generate-secret \
  --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
  --supported-identity-providers "COGNITO" \
  --read-attributes "email" "email_verified" "given_name" "family_name" \
  --write-attributes "email" "given_name" "family_name" \
  --prevent-user-existence-errors "ENABLED" \
  --region eu-west-2 \
  --output json)

CLIENT_ID=$(echo "$CLIENT_OUTPUT" | grep '"ClientId"' | cut -d'"' -f4)
CLIENT_SECRET=$(echo "$CLIENT_OUTPUT" | grep '"ClientSecret"' | cut -d'"' -f4)
echo "Client ID: $CLIENT_ID"
echo "Client Secret: $CLIENT_SECRET"

# Step 3: Create Admin User
echo "Creating admin user..."
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "admin" \
  --user-attributes Name=email,Value="i.srikanth@hotmail.com" Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --region eu-west-2

echo "Admin user created successfully!"

# Step 4: Output environment variables
echo ""
echo "Add these to your .env.local file:"
echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID"
echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
echo "COGNITO_CLIENT_SECRET=$CLIENT_SECRET"
echo "NEXT_PUBLIC_AWS_REGION=eu-west-2"
echo ""
echo "Setup complete!" 