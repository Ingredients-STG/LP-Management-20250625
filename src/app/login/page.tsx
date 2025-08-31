'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { signUp, confirmSignUp, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Tabs,
  Stack,
  Group,
  Alert,
  ThemeIcon,
  Box,
  Divider,
  Loader,
  Center
} from '@mantine/core';
import {
  IconDroplet,
  IconMail,
  IconLock,
  IconUser,
  IconKey,
  IconCheck,
  IconAlertCircle,
  IconShield
} from '@tabler/icons-react';
import Image from 'next/image';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string | null>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  
  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    code: ''
  });
  
  // Forgot password state
  const [forgotPasswordData, setForgotPasswordData] = useState({
    email: '',
    code: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
  const [signupStep, setSignupStep] = useState(1);
  
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(loginData.email, loginData.password);
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      setError(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await signUp({
        username: signupData.email,
        password: signupData.password,
        options: {
          userAttributes: {
            email: signupData.email,
            given_name: signupData.firstName,
            family_name: signupData.lastName
          }
        }
      });
      setSuccess('Account created! Please check your email for verification code.');
      setSignupStep(2);
    } catch (error: any) {
      setError(error.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await confirmSignUp({
        username: signupData.email,
        confirmationCode: signupData.code || ''
      });
      setSuccess('Account verified successfully! You can now sign in.');
      setActiveTab('login');
      setSignupStep(1);
    } catch (error: any) {
      setError(error.message || 'Failed to verify account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await resetPassword({ username: forgotPasswordData.email });
      setSuccess('Password reset code sent to your email.');
      setForgotPasswordStep(2);
    } catch (error: any) {
      setError(error.message || 'Failed to send reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (forgotPasswordData.newPassword !== forgotPasswordData.confirmNewPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await confirmResetPassword({
        username: forgotPasswordData.email,
        confirmationCode: forgotPasswordData.code,
        newPassword: forgotPasswordData.newPassword
      });
      setSuccess('Password reset successfully! You can now sign in with your new password.');
      setActiveTab('login');
      setForgotPasswordStep(1);
    } catch (error: any) {
      setError(error.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box 
      style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <Container size={480} my={40}>
        {/* Header */}
        <Group justify="center" mb={30}>
          <Paper 
            withBorder 
            p={15} 
            radius="md" 
            style={{ 
              backgroundColor: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Image
              src="/st-georges-nhs-logo.svg"
              alt="St Georges NHS Logo"
              width={300}
              height={75}
              style={{ display: 'block' }}
            />
          </Paper>
        </Group>
        
        <Title ta="center" mb={8} style={{ color: '#005EB8', fontSize: '24px', fontWeight: 600 }}>
          Water Safety Team
        </Title>
        
        <Text c="dimmed" size="sm" ta="center" mb={30} style={{ color: '#666666' }}>
          Asset Management System
        </Text>

        <Paper withBorder shadow="md" p={30} radius="md" style={{ backgroundColor: 'white' }}>
          <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
            <Tabs.List grow mb="xl" style={{ backgroundColor: '#f1f3f4' }}>
              <Tabs.Tab 
                value="login" 
                leftSection={<IconUser size={16} />}
                style={{ fontWeight: 500 }}
              >
                Sign In
              </Tabs.Tab>
              <Tabs.Tab 
                value="signup" 
                leftSection={<IconMail size={16} />}
                style={{ 
                  fontWeight: 500, 
                  opacity: 0.5, 
                  cursor: 'not-allowed',
                  pointerEvents: 'none',
                  backgroundColor: '#e9ecef',
                  color: '#6c757d'
                }}
                disabled
              >
                Sign Up (Disabled)
              </Tabs.Tab>
              <Tabs.Tab 
                value="forgot" 
                leftSection={<IconKey size={16} />}
                style={{ fontWeight: 500 }}
              >
                Reset
              </Tabs.Tab>
            </Tabs.List>

            {(error || success) && (
              <Alert 
                icon={error ? <IconAlertCircle size={16} /> : <IconCheck size={16} />}
                color={error ? 'red' : 'green'}
                mb="md"
                variant="light"
              >
                {error || success}
              </Alert>
            )}

            <Tabs.Panel value="login">
              <form onSubmit={handleLogin}>
                <Stack>
                  <TextInput
                    required
                    label="Email Address"
                    placeholder="Enter your email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                    leftSection={<IconMail size={16} />}
                    size="md"
                  />

                  <PasswordInput
                    required
                    label="Password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                    leftSection={<IconLock size={16} />}
                    size="md"
                  />

                  <Button 
                    type="submit" 
                    fullWidth 
                    mt="xl" 
                    size="md"
                    loading={isLoading}
                    leftSection={isLoading ? <Loader size={16} /> : <IconShield size={16} />}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </Stack>
              </form>
            </Tabs.Panel>

            <Tabs.Panel value="signup">
              {signupStep === 1 ? (
                <form onSubmit={handleSignup}>
                  <Stack>
                    <Group grow>
                      <TextInput
                        required
                        label="First Name"
                        placeholder="John"
                        value={signupData.firstName}
                        onChange={(e) => setSignupData({...signupData, firstName: e.target.value})}
                        size="md"
                      />
                      <TextInput
                        required
                        label="Last Name"
                        placeholder="Doe"
                        value={signupData.lastName}
                        onChange={(e) => setSignupData({...signupData, lastName: e.target.value})}
                        size="md"
                      />
                    </Group>

                    <TextInput
                      required
                      label="Email Address"
                      placeholder="Enter your email"
                      value={signupData.email}
                      onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                      leftSection={<IconMail size={16} />}
                      size="md"
                    />

                    <PasswordInput
                      required
                      label="Password"
                      placeholder="Create a password"
                      value={signupData.password}
                      onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                      leftSection={<IconLock size={16} />}
                      size="md"
                    />

                    <PasswordInput
                      required
                      label="Confirm Password"
                      placeholder="Confirm your password"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({...signupData, confirmPassword: e.target.value})}
                      leftSection={<IconLock size={16} />}
                      size="md"
                    />

                    <Button 
                      type="submit" 
                      fullWidth 
                      mt="xl" 
                      size="md"
                      loading={isLoading}
                      color="green"
                      leftSection={isLoading ? <Loader size={16} /> : <IconUser size={16} />}
                    >
                      {isLoading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </Stack>
                </form>
              ) : (
                <form onSubmit={handleConfirmSignup}>
                  <Stack align="center">
                    <ThemeIcon color="green" size={60} radius="xl">
                      <IconCheck size={30} />
                    </ThemeIcon>
                    
                    <Title order={3} ta="center">Verify Your Email</Title>
                    <Text size="sm" ta="center" c="dimmed">
                      We've sent a verification code to<br />
                      <strong>{signupData.email}</strong>
                    </Text>

                    <TextInput
                      required
                      label="Verification Code"
                      placeholder="Enter 6-digit code"
                      value={signupData.code}
                      onChange={(e) => setSignupData({...signupData, code: e.target.value})}
                      ta="center"
                      size="md"
                      maxLength={6}
                      style={{ letterSpacing: '0.2em' }}
                    />

                    <Button 
                      type="submit" 
                      fullWidth 
                      mt="xl" 
                      size="md"
                      loading={isLoading}
                      color="green"
                      leftSection={isLoading ? <Loader size={16} /> : <IconCheck size={16} />}
                    >
                      {isLoading ? 'Verifying...' : 'Verify Account'}
                    </Button>
                  </Stack>
                </form>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="forgot">
              {forgotPasswordStep === 1 ? (
                <form onSubmit={handleForgotPassword}>
                  <Stack align="center">
                    <ThemeIcon color="orange" size={60} radius="xl">
                      <IconKey size={30} />
                    </ThemeIcon>
                    
                    <Title order={3} ta="center">Reset Your Password</Title>
                    <Text size="sm" ta="center" c="dimmed" mb="md">
                      Enter your email address and we'll send you a reset code
                    </Text>

                    <TextInput
                      required
                      label="Email Address"
                      placeholder="Enter your email"
                      value={forgotPasswordData.email}
                      onChange={(e) => setForgotPasswordData({...forgotPasswordData, email: e.target.value})}
                      leftSection={<IconMail size={16} />}
                      size="md"
                      style={{ width: '100%' }}
                    />

                    <Button 
                      type="submit" 
                      fullWidth 
                      mt="xl" 
                      size="md"
                      loading={isLoading}
                      color="orange"
                      leftSection={isLoading ? <Loader size={16} /> : <IconMail size={16} />}
                    >
                      {isLoading ? 'Sending Code...' : 'Send Reset Code'}
                    </Button>
                  </Stack>
                </form>
              ) : (
                <form onSubmit={handleConfirmResetPassword}>
                  <Stack align="center">
                    <ThemeIcon color="orange" size={60} radius="xl">
                      <IconLock size={30} />
                    </ThemeIcon>
                    
                    <Title order={3} ta="center">Enter New Password</Title>
                    <Text size="sm" ta="center" c="dimmed" mb="md">
                      Enter the code sent to<br />
                      <strong>{forgotPasswordData.email}</strong>
                    </Text>

                    <TextInput
                      required
                      label="Reset Code"
                      placeholder="Enter 6-digit code"
                      value={forgotPasswordData.code}
                      onChange={(e) => setForgotPasswordData({...forgotPasswordData, code: e.target.value})}
                      ta="center"
                      size="md"
                      maxLength={6}
                      style={{ letterSpacing: '0.2em', width: '100%' }}
                    />

                    <PasswordInput
                      required
                      label="New Password"
                      placeholder="Enter new password"
                      value={forgotPasswordData.newPassword}
                      onChange={(e) => setForgotPasswordData({...forgotPasswordData, newPassword: e.target.value})}
                      leftSection={<IconLock size={16} />}
                      size="md"
                      style={{ width: '100%' }}
                    />

                    <PasswordInput
                      required
                      label="Confirm New Password"
                      placeholder="Confirm new password"
                      value={forgotPasswordData.confirmNewPassword}
                      onChange={(e) => setForgotPasswordData({...forgotPasswordData, confirmNewPassword: e.target.value})}
                      leftSection={<IconLock size={16} />}
                      size="md"
                      style={{ width: '100%' }}
                    />

                    <Button 
                      type="submit" 
                      fullWidth 
                      mt="xl" 
                      size="md"
                      loading={isLoading}
                      color="orange"
                      leftSection={isLoading ? <Loader size={16} /> : <IconCheck size={16} />}
                    >
                      {isLoading ? 'Resetting Password...' : 'Reset Password'}
                    </Button>
                  </Stack>
                </form>
              )}
            </Tabs.Panel>
          </Tabs>
        </Paper>

        <Text c="dimmed" size="sm" ta="center" mt={30}>
          © 2024 St Georges Water Safety Team. All rights reserved.
        </Text>
        <Text c="dimmed" size="xs" ta="center" mt={5}>
          Secured by AWS Cognito • Enterprise Grade Security
        </Text>
      </Container>
    </Box>
  );
} 