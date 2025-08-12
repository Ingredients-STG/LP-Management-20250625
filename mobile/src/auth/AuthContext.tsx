import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUser, signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import * as SecureStore from 'expo-secure-store';
import { configureAmplify } from '../lib/amplify';

export interface MobileUser {
  username: string;
  email?: string;
}

interface AuthContextValue {
  user: MobileUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    configureAmplify();
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const current = await getCurrentUser();
      const session = await fetchAuthSession();
      if (current && session.tokens) {
        setUser({ username: current.username, email: current.signInDetails?.loginId });
        try {
          await SecureStore.setItemAsync('idToken', session.tokens.idToken?.toString() ?? '');
        } catch {}
      } else {
        setUser(null);
        try { await SecureStore.deleteItemAsync('idToken'); } catch {}
      }
    } catch {
      setUser(null);
      try { await SecureStore.deleteItemAsync('idToken'); } catch {}
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignIn(email: string, password: string) {
    const { isSignedIn } = await signIn({ username: email, password });
    if (isSignedIn) await checkAuth();
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    try { await SecureStore.deleteItemAsync('idToken'); } catch {}
  }

  async function getIdToken() {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn: handleSignIn,
    signOut: handleSignOut,
    getIdToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
