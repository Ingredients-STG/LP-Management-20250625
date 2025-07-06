# AWS Cognito Authentication Setup

This document explains how to set up AWS Cognito authentication for the LP Management System.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (optional but recommended)
- Access to AWS Cognito service

## Step 1: Create Cognito User Pool

1. **Go to AWS Cognito Console**
   - Navigate to the AWS Cognito service in your AWS console
   - Select "User pools"

2. **Create User Pool**
   - Click "Create user pool"
   - Choose "Email" as the sign-in option
   - Configure the following settings:
     - **User pool name**: `lp-management-users`
     - **Alias attributes**: Email
     - **Required attributes**: Email, Name
     - **Password policy**: Default (minimum 8 characters)
     - **MFA**: Optional (recommended for production)

3. **Configure App Client**
   - Create an app client with the following settings:
     - **App client name**: `lp-management-client`
     - **Generate client secret**: No (for web apps)
     - **Enable username-password auth flow**: Yes
     - **Enable admin auth flow**: Yes (for admin operations)

## Step 2: Configure Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# AWS Configuration
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# AWS Cognito Configuration
NEXT_PUBLIC_AWS_REGION=eu-west-2
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_AWS_ACCESS_KEY_ID=your-access-key-id
NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY=your-secret-access-key

# DynamoDB Configuration
DYNAMODB_TABLE_NAME=water-tap-assets
DYNAMODB_REGION=eu-west-2

# S3 Configuration
S3_BUCKET_NAME=asset-files-development
S3_REGION=eu-west-2
```

## Step 3: Create Initial Admin User

You can create an initial admin user using the AWS CLI:

```bash
aws cognito-idp admin-create-user \
    --user-pool-id your-user-pool-id \
    --username admin \
    --user-attributes Name=email,Value=admin@sgwst.nhs.uk Name=name,Value="SGWST Admin" \
    --temporary-password TempPassword123! \
    --message-action SUPPRESS
```

Or create users through the AWS Console:
1. Go to your User Pool
2. Click "Users" tab
3. Click "Create user"
4. Fill in the required information

## Step 4: Configure User Pool Settings

### Password Policy
- Minimum length: 8 characters
- Require uppercase letters: Yes
- Require lowercase letters: Yes
- Require numbers: Yes
- Require symbols: Optional

### Account Recovery
- Enable "Email" for account recovery
- Configure email settings if needed

### Email Configuration
- Choose "Send email with Cognito" for development
- For production, configure SES for better deliverability

## Step 5: Test Authentication

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000/login`

3. Try signing in with the admin user you created

4. If it's the first login, you'll be prompted to set a new password

## Features Included

### Authentication Features
- **Sign In**: Username/email and password authentication
- **Sign Up**: New user registration with email verification
- **Password Reset**: Forgot password functionality
- **New Password**: Force password change on first login
- **Sign Out**: Secure logout with token cleanup

### Security Features
- **Token Management**: Automatic token storage and validation
- **Protected Routes**: Automatic redirection for unauthenticated users
- **Session Management**: Persistent authentication across browser sessions
- **Error Handling**: Comprehensive error handling for auth failures

### User Experience
- **Responsive Design**: Works on desktop and mobile
- **Loading States**: Visual feedback during authentication
- **Form Validation**: Client-side validation for all forms
- **Notifications**: Success/error messages for user actions

## Troubleshooting

### Common Issues

1. **"User does not exist" error**
   - Ensure the user has been created in the Cognito User Pool
   - Check that the username/email is correct

2. **"Invalid client" error**
   - Verify the `NEXT_PUBLIC_COGNITO_CLIENT_ID` is correct
   - Ensure the app client is properly configured

3. **"Access denied" error**
   - Check AWS credentials are correct
   - Verify IAM permissions for Cognito operations

4. **Email verification not working**
   - Check email configuration in Cognito
   - Verify SES settings if using custom email

### Debug Mode

Enable debug logging by adding to your `.env.local`:

```env
NEXT_PUBLIC_DEBUG_AUTH=true
```

This will log authentication events to the browser console.

## Production Considerations

### Security
- Use environment-specific User Pools
- Enable MFA for admin users
- Configure proper CORS settings
- Use HTTPS in production
- Implement proper session timeout

### Monitoring
- Enable CloudWatch logging for Cognito
- Monitor authentication metrics
- Set up alerts for failed login attempts

### Backup
- Export user data regularly
- Document recovery procedures
- Test disaster recovery plans

## API Integration

The authentication system automatically integrates with your existing API endpoints. The user information is available through:

- `useAuth()` hook for React components
- `getCurrentUser()` and `getCurrentUserEmail()` utility functions
- Automatic user identification in audit logs

## Support

For issues or questions:
1. Check the AWS Cognito documentation
2. Review the troubleshooting section above
3. Check the browser console for error messages
4. Contact your AWS administrator for permissions issues 