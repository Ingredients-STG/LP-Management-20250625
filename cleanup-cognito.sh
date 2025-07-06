#!/bin/bash

# LP Management - Cognito Cleanup Script
# This script removes all Cognito resources created by setup-cognito.sh

set -e  # Exit on any error

echo "🧹 LP Management - Cognito Cleanup Script"
echo "=========================================="

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

# Check if AWS CLI is installed and configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "AWS CLI is ready"
}

# Find User Pool by name
find_user_pool() {
    print_status "Looking for User Pool: LP-Management-Users"
    
    local pools=$(aws cognito-idp list-user-pools --max-items 60 --query 'UserPools[?Name==`LP-Management-Users`].Id' --output text)
    
    if [ -z "$pools" ]; then
        print_warning "No User Pool found with name 'LP-Management-Users'"
        return 1
    fi
    
    USER_POOL_ID=$(echo "$pools" | head -n1)
    print_success "Found User Pool: $USER_POOL_ID"
    return 0
}

# Delete User Pool Client
delete_user_pool_client() {
    if [ -z "$USER_POOL_ID" ]; then
        return 0
    fi
    
    print_status "Deleting User Pool Clients..."
    
    local clients=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --query 'UserPoolClients[].ClientId' --output text)
    
    if [ -n "$clients" ]; then
        for client_id in $clients; do
            print_status "Deleting client: $client_id"
            aws cognito-idp delete-user-pool-client --user-pool-id "$USER_POOL_ID" --client-id "$client_id"
            print_success "Deleted client: $client_id"
        done
    else
        print_status "No clients found to delete"
    fi
}

# Delete User Pool
delete_user_pool() {
    if [ -z "$USER_POOL_ID" ]; then
        return 0
    fi
    
    print_status "Deleting User Pool: $USER_POOL_ID"
    
    aws cognito-idp delete-user-pool --user-pool-id "$USER_POOL_ID"
    print_success "Deleted User Pool: $USER_POOL_ID"
}

# Clean up environment file
cleanup_env_file() {
    print_status "Cleaning up .env.local file..."
    
    local env_file=".env.local"
    local temp_file=".env.local.tmp"
    
    if [ -f "$env_file" ]; then
        # Create backup
        cp "$env_file" "$env_file.cleanup-backup"
        print_status "Backup created: $env_file.cleanup-backup"
        
        # Remove Cognito configuration
        grep -v "COGNITO\|AWS_REGION.*# AWS Cognito Configuration" "$env_file" > "$temp_file" || true
        
        # Remove empty lines at the end
        sed -i '' -e :a -e '/^\s*$/N;$!ba' -e 's/\n*$//' "$temp_file" 2>/dev/null || true
        
        mv "$temp_file" "$env_file"
        print_success "Environment file cleaned: $env_file"
    else
        print_status "No .env.local file found"
    fi
}

# Clean up generated files
cleanup_files() {
    print_status "Cleaning up generated files..."
    
    local files_to_remove=(
        "cognito-setup-summary.txt"
        ".env.local.backup"
    )
    
    for file in "${files_to_remove[@]}"; do
        if [ -f "$file" ]; then
            rm "$file"
            print_success "Removed: $file"
        fi
    done
}

# Confirmation prompt
confirm_cleanup() {
    echo
    print_warning "⚠️  WARNING: This will permanently delete all Cognito resources!"
    print_warning "   - User Pool and all users will be deleted"
    print_warning "   - App clients will be deleted"
    print_warning "   - Environment configuration will be removed"
    echo
    
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        print_status "Cleanup cancelled"
        exit 0
    fi
    
    print_status "Cleanup confirmed. Proceeding..."
}

# Main execution
main() {
    echo
    print_status "Starting Cognito cleanup process..."
    
    # Pre-flight checks
    check_aws_cli
    confirm_cleanup
    
    echo
    print_status "Removing AWS resources..."
    
    # Find and delete resources
    if find_user_pool; then
        delete_user_pool_client
        delete_user_pool
    fi
    
    echo
    print_status "Cleaning up local files..."
    
    # Clean up local files
    cleanup_env_file
    cleanup_files
    
    echo
    print_success "🎉 Cognito cleanup completed successfully!"
    echo
    print_status "Your application will now run in development mode with mock authentication."
    print_status "To set up Cognito again, run: ./setup-cognito.sh"
}

# Run main function
main "$@" 