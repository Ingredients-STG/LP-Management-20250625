'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CognitoAuthService, { AuthUser } from '@/lib/cognito';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string; requiresNewPassword?: boolean; session?: string }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated on app load
    const checkAuth = async () => {
      try {
        const storedUser = CognitoAuthService.getStoredUser();
        if (storedUser) {
          // Verify the token is still valid
          try {
            await CognitoAuthService.getUserInfo(storedUser.accessToken);
            setUser(storedUser);
          } catch (error) {
            // Token is invalid, clear it
            console.error('Token validation failed:', error);
            CognitoAuthService.clearTokens();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        CognitoAuthService.clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const result = await CognitoAuthService.signIn(username, password);
      
      if (result.success && result.user) {
        setUser(result.user);
        return { success: true };
      } else if (result.requiresNewPassword) {
        return { 
          success: false, 
          requiresNewPassword: true, 
          session: result.session 
        };
      } else {
        return { 
          success: false, 
          error: result.error || 'Sign in failed' 
        };
      }
    } catch (error) {
      console.error('Sign in error:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred' 
      };
    }
  };

  const signOut = async () => {
    try {
      await CognitoAuthService.signOut(user?.accessToken);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 