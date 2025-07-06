#!/bin/bash

# LP Management - Cognito Setup Script
# This script creates a complete Cognito User Pool setup for the LP Management System

set -e  # Exit on any error

echo "🚀 LP Management - Cognito Setup Script"
echo "========================================"

# Configuration
POOL_NAME="LP-Management-Users"
CLIENT_NAME="LP-Management-Client"
REGION="eu-west-2"
ADMIN_EMAIL=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first:"
        echo "  macOS: brew install awscli"
        echo "  Other: https://aws.amazon.com/cli/"
        exit 1
    fi
    print_success "AWS CLI is installed"
}

# Check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    local identity=$(aws sts get-caller-identity --query 'Arn' --output text)
    print_success "AWS CLI is configured as: $identity"
}

# Get admin email
get_admin_email() {
    if [ -z "$ADMIN_EMAIL" ]; then
        echo -n "Enter admin email address: "
        read ADMIN_EMAIL
        
        if [ -z "$ADMIN_EMAIL" ]; then
            print_error "Admin email is required"
            exit 1
        fi
    fi
    print_status "Admin email: $ADMIN_EMAIL"
}

# Create User Pool
create_user_pool() {
    print_status "Creating Cognito User Pool..."
    
    local pool_output=$(aws cognito-idp create-user-pool \
        --pool-name "$POOL_NAME" \
        --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
        --auto-verified-attributes email \
        --username-attributes email \
        --verification-message-template "DefaultEmailOption=CONFIRM_WITH_CODE" \
        --mfa-configuration OFF \
        --account-recovery-setting "RecoveryMechanisms=[{Name=verified_email,Priority=1}]" \
        --admin-create-user-config "AllowAdminCreateUserOnly=false" \
        --user-pool-tags "Project=LP-Management,Environment=Production" \
        --region "$REGION" 2>&1)
    
    if [ $? -eq 0 ]; then
        USER_POOL_ID=$(echo "$pool_output" | jq -r '.UserPool.Id')
        print_success "User Pool created: $USER_POOL_ID"
    else
        print_error "Failed to create User Pool: $pool_output"
        exit 1
    fi
}

# Create User Pool Client
create_user_pool_client() {
    print_status "Creating User Pool Client..."
    
    local client_output=$(aws cognito-idp create-user-pool-client \
        --user-pool-id "$USER_POOL_ID" \
        --client-name "$CLIENT_NAME" \
        --generate-secret \
        --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" \
        --supported-identity-providers "COGNITO" \
        --read-attributes "email" "email_verified" "given_name" "family_name" \
        --write-attributes "email" "given_name" "family_name" \
        --prevent-user-existence-errors "ENABLED" \
        --region "$REGION" 2>&1)
    
    if [ $? -eq 0 ]; then
        CLIENT_ID=$(echo "$client_output" | jq -r '.UserPoolClient.ClientId')
        CLIENT_SECRET=$(echo "$client_output" | jq -r '.UserPoolClient.ClientSecret')
        print_success "User Pool Client created: $CLIENT_ID"
    else
        print_error "Failed to create User Pool Client: $client_output"
        exit 1
    fi
}

# Create Admin User
create_admin_user() {
    print_status "Creating admin user..."
    
    local admin_output=$(aws cognito-idp admin-create-user \
        --user-pool-id "$USER_POOL_ID" \
        --username "admin" \
        --user-attributes Name=email,Value="$ADMIN_EMAIL" Name=email_verified,Value=true \
        --temporary-password "TempPass123!" \
        --message-action SUPPRESS \
        --region "$REGION" 2>&1)
    
    if [ $? -eq 0 ]; then
        print_success "Admin user created with username: admin"
        print_warning "Temporary password: TempPass123!"
    else
        print_error "Failed to create admin user: $admin_output"
        exit 1
    fi
}

# Create or update .env.local file
update_env_file() {
    print_status "Updating .env.local file..."
    
    local env_file=".env.local"
    local temp_file=".env.local.tmp"
    
    # Create backup if file exists
    if [ -f "$env_file" ]; then
        cp "$env_file" "$env_file.backup"
        print_status "Backup created: $env_file.backup"
    fi
    
    # Remove existing Cognito configuration if present
    if [ -f "$env_file" ]; then
        grep -v "COGNITO\|AWS_REGION" "$env_file" > "$temp_file" || true
    else
        touch "$temp_file"
    fi
    
    # Add new Cognito configuration
    cat >> "$temp_file" << EOF

# AWS Cognito Configuration - Generated by setup-cognito.sh
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID
COGNITO_CLIENT_SECRET=$CLIENT_SECRET
NEXT_PUBLIC_AWS_REGION=$REGION
EOF
    
    mv "$temp_file" "$env_file"
    print_success "Environment file updated: $env_file"
}

# Create summary file
create_summary() {
    local summary_file="cognito-setup-summary.txt"
    
    cat > "$summary_file" << EOF
LP Management - Cognito Setup Summary
====================================

Setup completed on: $(date)

AWS Region: $REGION
User Pool ID: $USER_POOL_ID
Client ID: $CLIENT_ID
Client Secret: $CLIENT_SECRET

Admin User:
- Username: admin
- Email: $ADMIN_EMAIL
- Temporary Password: TempPass123!

Next Steps:
1. Start your development server: npm run dev
2. Navigate to http://localhost:3000
3. Login with username 'admin' and password 'TempPass123!'
4. Set a new password when prompted

Important Notes:
- Keep this file secure and do not commit it to version control
- The Client Secret is sensitive - treat it like a password
- Users can now sign up directly through the application
- Password reset functionality is enabled

Support:
- Check COGNITO_SETUP.md for detailed documentation
- AWS Cognito Console: https://console.aws.amazon.com/cognito/
EOF

    print_success "Setup summary saved to: $summary_file"
}

# Main execution
main() {
    echo
    print_status "Starting Cognito setup process..."
    
    # Pre-flight checks
    check_aws_cli
    check_aws_config
    get_admin_email
    
    echo
    print_status "Creating AWS resources..."
    
    # Create resources
    create_user_pool
    create_user_pool_client
    create_admin_user
    
    echo
    print_status "Configuring application..."
    
    # Configure app
    update_env_file
    create_summary
    
    echo
    print_success "🎉 Cognito setup completed successfully!"
    echo
    echo "Configuration Details:"
    echo "====================="
    echo "User Pool ID: $USER_POOL_ID"
    echo "Client ID: $CLIENT_ID"
    echo "Region: $REGION"
    echo "Admin Email: $ADMIN_EMAIL"
    echo
    echo "Next Steps:"
    echo "1. Run: npm run dev"
    echo "2. Open: http://localhost:3000"
    echo "3. Login with username 'admin' and password 'TempPass123!'"
    echo "4. Set a new password when prompted"
    echo
    print_warning "Important: Keep your Client Secret secure!"
}

# Run main function
main "$@" 