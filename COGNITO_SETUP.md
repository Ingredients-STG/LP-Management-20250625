# AWS Cognito Setup Guide

## Prerequisites
- AWS CLI installed and configured with your credentials
- Node.js and npm installed
- Your LP Management project ready

## Step 1: Install AWS CLI (if not already installed)
```bash
# macOS
brew install awscli

# Or download from: https://aws.amazon.com/cli/
```

## Step 2: Configure AWS CLI
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter output format: json
```

## Step 3: Create Cognito User Pool

Run these commands in your terminal:

```bash
# Create the User Pool
aws cognito-idp create-user-pool \
  --pool-name "LP-Management-Users" \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --auto-verified-attributes email \
  --username-attributes email \
  --verification-message-template "DefaultEmailOption=CONFIRM_WITH_CODE" \
  --mfa-configuration OFF \
  --account-recovery-setting "RecoveryMechanisms=[{Name=verified_email,Priority=1}]" \
  --admin-create-user-config "AllowAdminCreateUserOnly=false" \
  --user-pool-tags "Project=LP-Management,Environment=Production"
```

**Save the UserPoolId from the output - you'll need it for the next step!**

## Step 4: Create User Pool Client

Replace `YOUR_USER_POOL_ID` with the ID from Step 3:

```bash
# Create the User Pool Client
aws cognito-idp create-user-pool-client \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-name "LP-Management-Client" \
  --generate-secret \
  --explicit-auth-flows "ADMIN_NO_SRP_AUTH" "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
  --supported-identity-providers "COGNITO" \
  --read-attributes "email" "email_verified" "given_name" "family_name" \
  --write-attributes "email" "given_name" "family_name" \
  --prevent-user-existence-errors "ENABLED"
```

**Save the ClientId and ClientSecret from the output!**

## Step 5: Create Admin User

Replace `YOUR_USER_POOL_ID` and use your email:

```bash
# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username admin \
  --user-attributes Name=email,Value=your-email@example.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

## Step 6: Update Environment Variables

Add these to your `.env.local` file:

```env
# AWS Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=YOUR_USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=YOUR_CLIENT_ID
COGNITO_CLIENT_SECRET=YOUR_CLIENT_SECRET
NEXT_PUBLIC_AWS_REGION=us-east-1
```

## Step 7: Test the Setup

1. Start your development server:
```bash
npm run dev
```

2. Navigate to `http://localhost:3000`
3. You should be redirected to the login page
4. Try logging in with:
   - Username: `admin`
   - Password: `TempPass123!`
5. You'll be prompted to set a new password

## Step 8: Create Additional Users (Optional)

```bash
# Create regular user
aws cognito-idp admin-create-user \
  --user-pool-id YOUR_USER_POOL_ID \
  --username user1 \
  --user-attributes Name=email,Value=user1@example.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

## Troubleshooting

### Common Issues:

1. **Invalid credentials**: Make sure AWS CLI is configured correctly
2. **Region mismatch**: Ensure all commands use the same region
3. **Permission denied**: Your AWS user needs Cognito permissions

### Required AWS Permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:CreateUserPool",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminInitiateAuth",
        "cognito-idp:AdminRespondToAuthChallenge"
      ],
      "Resource": "*"
    }
  ]
}
```

## Alternative: One-Click Setup Script

I can create a setup script that does all of this automatically. Would you like me to create that script for you?

## Production Considerations

1. **Security**: Never commit your `.env.local` file to git
2. **Backup**: Save your User Pool ID and Client credentials securely
3. **Monitoring**: Enable CloudWatch logs for Cognito
4. **Scaling**: Consider using Cognito Identity Pools for additional features

## Next Steps

Once you have the Cognito setup complete:
1. The app will automatically use real Cognito authentication
2. Development mode will be disabled
3. Users can sign up, sign in, and reset passwords
4. All audit logs will use real user information

Let me know if you need help with any of these steps! 