'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingOverlay } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <LoadingOverlay visible={true} />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
} 