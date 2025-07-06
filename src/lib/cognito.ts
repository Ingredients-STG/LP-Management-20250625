import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ChangePasswordCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AuthFlowType,
  ChallengeNameType,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Cognito configuration
const REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-2';
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '';

// Check if we're in development mode (missing Cognito config)
const isDevelopmentMode = !USER_POOL_ID || !CLIENT_ID;

// Create Cognito client only if we have proper configuration
let cognitoClient: CognitoIdentityProviderClient | null = null;

if (!isDevelopmentMode) {
  cognitoClient = new CognitoIdentityProviderClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
    },
  });
}

export interface AuthUser {
  username: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  sub: string;
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  challengeName?: string;
  session?: string;
  requiresNewPassword?: boolean;
}

export class CognitoAuthService {
  // Development mode mock users
  private static mockUsers = [
    {
      username: 'admin',
      password: 'password123',
      email: 'admin@sgwst.nhs.uk',
      name: 'SGWST Admin',
    },
    {
      username: 'user',
      password: 'password123',
      email: 'user@sgwst.nhs.uk',
      name: 'SGWST User',
    },
  ];

  // Development mode sign in
  private static mockSignIn(username: string, password: string): AuthResult {
    const user = this.mockUsers.find(u => 
      (u.username === username || u.email === username) && u.password === password
    );

    if (user) {
      const mockUser: AuthUser = {
        username: user.username,
        email: user.email,
        name: user.name,
        sub: `mock-${user.username}`,
        accessToken: `mock-access-token-${Date.now()}`,
        refreshToken: `mock-refresh-token-${Date.now()}`,
        idToken: `mock-id-token-${Date.now()}`,
      };

      this.storeTokens(mockUser);

      return {
        success: true,
        user: mockUser,
      };
    }

    return {
      success: false,
      error: 'Invalid username or password',
    };
  }

  // Sign in user
  static async signIn(username: string, password: string): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      console.log('🔧 Development Mode: Using mock authentication');
      console.log('Available mock users:', this.mockUsers.map(u => ({ username: u.username, email: u.email })));
      return this.mockSignIn(username, password);
    }

    // Production mode with Cognito
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient!.send(command);

      if (response.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
        return {
          success: false,
          challengeName: response.ChallengeName,
          session: response.Session,
          requiresNewPassword: true,
        };
      }

      if (response.AuthenticationResult) {
        const userInfo = await this.getUserInfo(response.AuthenticationResult.AccessToken!);
        
        const user: AuthUser = {
          username: userInfo.Username!,
          email: userInfo.UserAttributes?.find(attr => attr.Name === 'email')?.Value || '',
          name: userInfo.UserAttributes?.find(attr => attr.Name === 'name')?.Value,
          given_name: userInfo.UserAttributes?.find(attr => attr.Name === 'given_name')?.Value,
          family_name: userInfo.UserAttributes?.find(attr => attr.Name === 'family_name')?.Value,
          sub: userInfo.UserAttributes?.find(attr => attr.Name === 'sub')?.Value || '',
          accessToken: response.AuthenticationResult.AccessToken!,
          refreshToken: response.AuthenticationResult.RefreshToken!,
          idToken: response.AuthenticationResult.IdToken!,
        };

        // Store tokens in localStorage
        this.storeTokens(user);

        return {
          success: true,
          user,
        };
      }

      return {
        success: false,
        error: 'Authentication failed',
      };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error.message || 'Sign in failed',
      };
    }
  }

  // Set new password for first-time login
  static async setNewPassword(
    username: string,
    newPassword: string,
    session: string
  ): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      return {
        success: false,
        error: 'New password setting not available in development mode',
      };
    }

    try {
      const command = new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: newPassword,
        },
      });

      const response = await cognitoClient!.send(command);

      if (response.AuthenticationResult) {
        const userInfo = await this.getUserInfo(response.AuthenticationResult.AccessToken!);
        
        const user: AuthUser = {
          username: userInfo.Username!,
          email: userInfo.UserAttributes?.find(attr => attr.Name === 'email')?.Value || '',
          name: userInfo.UserAttributes?.find(attr => attr.Name === 'name')?.Value,
          given_name: userInfo.UserAttributes?.find(attr => attr.Name === 'given_name')?.Value,
          family_name: userInfo.UserAttributes?.find(attr => attr.Name === 'family_name')?.Value,
          sub: userInfo.UserAttributes?.find(attr => attr.Name === 'sub')?.Value || '',
          accessToken: response.AuthenticationResult.AccessToken!,
          refreshToken: response.AuthenticationResult.RefreshToken!,
          idToken: response.AuthenticationResult.IdToken!,
        };

        this.storeTokens(user);

        return {
          success: true,
          user,
        };
      }

      return {
        success: false,
        error: 'Failed to set new password',
      };
    } catch (error: any) {
      console.error('Set new password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to set new password',
      };
    }
  }

  // Sign up new user
  static async signUp(
    username: string,
    password: string,
    email: string,
    name?: string
  ): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      return {
        success: false,
        error: 'Sign up not available in development mode. Use mock credentials: admin/password123 or user/password123',
      };
    }

    try {
      const userAttributes = [
        {
          Name: 'email',
          Value: email,
        },
      ];

      if (name) {
        userAttributes.push({
          Name: 'name',
          Value: name,
        });
      }

      const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: userAttributes,
      });

      await cognitoClient!.send(command);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: error.message || 'Sign up failed',
      };
    }
  }

  // Confirm sign up with verification code
  static async confirmSignUp(username: string, code: string): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      return {
        success: false,
        error: 'Email verification not available in development mode',
      };
    }

    try {
      const command = new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
      });

      await cognitoClient!.send(command);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Confirm sign up error:', error);
      return {
        success: false,
        error: error.message || 'Confirmation failed',
      };
    }
  }

  // Resend confirmation code
  static async resendConfirmationCode(username: string): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      return {
        success: false,
        error: 'Email verification not available in development mode',
      };
    }

    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: CLIENT_ID,
        Username: username,
      });

      await cognitoClient!.send(command);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Resend confirmation code error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resend confirmation code',
      };
    }
  }

  // Forgot password
  static async forgotPassword(username: string): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      return {
        success: false,
        error: 'Password reset not available in development mode',
      };
    }

    try {
      const command = new ForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: username,
      });

      await cognitoClient!.send(command);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to initiate password reset',
      };
    }
  }

  // Confirm forgot password
  static async confirmForgotPassword(
    username: string,
    code: string,
    newPassword: string
  ): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      return {
        success: false,
        error: 'Password reset not available in development mode',
      };
    }

    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
        Password: newPassword,
      });

      await cognitoClient!.send(command);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Confirm forgot password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to reset password',
      };
    }
  }

  // Get current user info
  static async getUserInfo(accessToken: string) {
    // Development mode
    if (isDevelopmentMode) {
      return {
        Username: 'mock-user',
        UserAttributes: [
          { Name: 'email', Value: 'admin@sgwst.nhs.uk' },
          { Name: 'name', Value: 'SGWST Admin' },
          { Name: 'sub', Value: 'mock-sub' },
        ],
      };
    }

    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    return await cognitoClient!.send(command);
  }

  // Sign out user
  static async signOut(accessToken?: string): Promise<void> {
    try {
      if (!isDevelopmentMode && accessToken) {
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken,
        });
        await cognitoClient!.send(command);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      // Always clear local storage
      this.clearTokens();
    }
  }

  // Store tokens in localStorage
  static storeTokens(user: AuthUser): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('access_token', user.accessToken);
      localStorage.setItem('refresh_token', user.refreshToken);
      localStorage.setItem('id_token', user.idToken);
    }
  }

  // Get stored user from localStorage
  static getStoredUser(): AuthUser | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('auth_user');
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch (error) {
          console.error('Error parsing stored user:', error);
          this.clearTokens();
        }
      }
    }
    return null;
  }

  // Clear tokens from localStorage
  static clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('id_token');
    }
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    return this.getStoredUser() !== null;
  }

  // Get current user
  static getCurrentUser(): AuthUser | null {
    return this.getStoredUser();
  }

  // Check if we're in development mode
  static isDevelopmentMode(): boolean {
    return isDevelopmentMode;
  }

  // Change password
  static async changePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string
  ): Promise<AuthResult> {
    // Development mode
    if (isDevelopmentMode) {
      return {
        success: false,
        error: 'Password change not available in development mode',
      };
    }

    try {
      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: oldPassword,
        ProposedPassword: newPassword,
      });

      await cognitoClient!.send(command);

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to change password',
      };
    }
  }
}

export default CognitoAuthService; 