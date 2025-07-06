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

// Create Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
  },
});

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
  // Sign in user
  static async signIn(username: string, password: string): Promise<AuthResult> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(command);

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

      const response = await cognitoClient.send(command);

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

      await cognitoClient.send(command);

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
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
      });

      await cognitoClient.send(command);

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
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: CLIENT_ID,
        Username: username,
      });

      await cognitoClient.send(command);

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
    try {
      const command = new ForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: username,
      });

      await cognitoClient.send(command);

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
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: username,
        ConfirmationCode: code,
        Password: newPassword,
      });

      await cognitoClient.send(command);

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
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    return await cognitoClient.send(command);
  }

  // Sign out user
  static async signOut(accessToken?: string): Promise<void> {
    try {
      if (accessToken) {
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken,
        });
        await cognitoClient.send(command);
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

  // Change password
  static async changePassword(
    accessToken: string,
    oldPassword: string,
    newPassword: string
  ): Promise<AuthResult> {
    try {
      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: oldPassword,
        ProposedPassword: newPassword,
      });

      await cognitoClient.send(command);

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