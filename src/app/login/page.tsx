'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Anchor,
  Container,
  Group,
  Stack,
  Alert,
  LoadingOverlay,
  Divider,
  Modal,
  PinInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { IconAlertCircle, IconCheck, IconLock, IconUser, IconMail } from '@tabler/icons-react';
import CognitoAuthService from '@/lib/cognito';

interface LoginForm {
  username: string;
  password: string;
}

interface SignUpForm {
  username: string;
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

interface ForgotPasswordForm {
  username: string;
}

interface ResetPasswordForm {
  username: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset' | 'confirm' | 'newpassword'>('signin');
  const [error, setError] = useState<string>('');
  const [pendingUsername, setPendingUsername] = useState<string>('');
  const [session, setSession] = useState<string>('');
  
  const [signUpModalOpened, { open: openSignUpModal, close: closeSignUpModal }] = useDisclosure(false);
  const [forgotPasswordModalOpened, { open: openForgotPasswordModal, close: closeForgotPasswordModal }] = useDisclosure(false);
  const [confirmModalOpened, { open: openConfirmModal, close: closeConfirmModal }] = useDisclosure(false);
  const [resetPasswordModalOpened, { open: openResetPasswordModal, close: closeResetPasswordModal }] = useDisclosure(false);
  const [newPasswordModalOpened, { open: openNewPasswordModal, close: closeNewPasswordModal }] = useDisclosure(false);

  // Check if user is already authenticated
  useEffect(() => {
    if (CognitoAuthService.isAuthenticated()) {
      router.push('/');
    }
  }, [router]);

  // Login form
  const loginForm = useForm<LoginForm>({
    initialValues: {
      username: '',
      password: '',
    },
    validate: {
      username: (value) => (value.length < 1 ? 'Username is required' : null),
      password: (value) => (value.length < 1 ? 'Password is required' : null),
    },
  });

  // Sign up form
  const signUpForm = useForm<SignUpForm>({
    initialValues: {
      username: '',
      email: '',
      name: '',
      password: '',
      confirmPassword: '',
    },
    validate: {
      username: (value) => (value.length < 3 ? 'Username must be at least 3 characters' : null),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      name: (value) => (value.length < 1 ? 'Name is required' : null),
      password: (value) => (value.length < 8 ? 'Password must be at least 8 characters' : null),
      confirmPassword: (value, values) =>
        value !== values.password ? 'Passwords do not match' : null,
    },
  });

  // Forgot password form
  const forgotPasswordForm = useForm<ForgotPasswordForm>({
    initialValues: {
      username: '',
    },
    validate: {
      username: (value) => (value.length < 1 ? 'Username is required' : null),
    },
  });

  // Reset password form
  const resetPasswordForm = useForm<ResetPasswordForm>({
    initialValues: {
      username: '',
      code: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      code: (value) => (value.length < 6 ? 'Verification code is required' : null),
      newPassword: (value) => (value.length < 8 ? 'Password must be at least 8 characters' : null),
      confirmPassword: (value, values) =>
        value !== values.newPassword ? 'Passwords do not match' : null,
    },
  });

  // New password form (for first-time login)
  const newPasswordForm = useForm({
    initialValues: {
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      newPassword: (value) => (value.length < 8 ? 'Password must be at least 8 characters' : null),
      confirmPassword: (value, values) =>
        value !== values.newPassword ? 'Passwords do not match' : null,
    },
  });

  // Confirmation code form
  const [confirmationCode, setConfirmationCode] = useState('');

  const handleSignIn = async (values: LoginForm) => {
    setLoading(true);
    setError('');

    try {
      const result = await CognitoAuthService.signIn(values.username, values.password);

      if (result.success && result.user) {
        notifications.show({
          title: 'Success',
          message: 'Signed in successfully!',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        router.push('/');
      } else if (result.requiresNewPassword) {
        setPendingUsername(values.username);
        setSession(result.session!);
        openNewPasswordModal();
      } else {
        setError(result.error || 'Sign in failed');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Sign in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (values: SignUpForm) => {
    setLoading(true);
    setError('');

    try {
      const result = await CognitoAuthService.signUp(
        values.username,
        values.password,
        values.email,
        values.name
      );

      if (result.success) {
        setPendingUsername(values.username);
        closeSignUpModal();
        openConfirmModal();
        notifications.show({
          title: 'Success',
          message: 'Account created! Please check your email for verification code.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        setError(result.error || 'Sign up failed');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Sign up error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    if (confirmationCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await CognitoAuthService.confirmSignUp(pendingUsername, confirmationCode);

      if (result.success) {
        closeConfirmModal();
        notifications.show({
          title: 'Success',
          message: 'Account verified! You can now sign in.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setConfirmationCode('');
        setPendingUsername('');
      } else {
        setError(result.error || 'Verification failed');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Confirm sign up error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await CognitoAuthService.resendConfirmationCode(pendingUsername);

      if (result.success) {
        notifications.show({
          title: 'Success',
          message: 'Verification code sent!',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Resend code error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (values: ForgotPasswordForm) => {
    setLoading(true);
    setError('');

    try {
      const result = await CognitoAuthService.forgotPassword(values.username);

      if (result.success) {
        setPendingUsername(values.username);
        closeForgotPasswordModal();
        openResetPasswordModal();
        notifications.show({
          title: 'Success',
          message: 'Password reset code sent to your email!',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        setError(result.error || 'Failed to initiate password reset');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Forgot password error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values: ResetPasswordForm) => {
    setLoading(true);
    setError('');

    try {
      const result = await CognitoAuthService.confirmForgotPassword(
        pendingUsername,
        values.code,
        values.newPassword
      );

      if (result.success) {
        closeResetPasswordModal();
        notifications.show({
          title: 'Success',
          message: 'Password reset successfully! You can now sign in.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        resetPasswordForm.reset();
        setPendingUsername('');
      } else {
        setError(result.error || 'Password reset failed');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Reset password error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (values: any) => {
    setLoading(true);
    setError('');

    try {
      const result = await CognitoAuthService.setNewPassword(
        pendingUsername,
        values.newPassword,
        session
      );

      if (result.success && result.user) {
        closeNewPasswordModal();
        notifications.show({
          title: 'Success',
          message: 'Password set successfully! Signing you in...',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        router.push('/');
      } else {
        setError(result.error || 'Failed to set new password');
      }
    } catch (error) {
      setError('An unexpected error occurred');
      console.error('Set new password error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <LoadingOverlay visible={loading} />
      
      <Title ta="center" mb="xl">
        LP Management System
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <Title order={2} ta="center" mb="md">
          Sign In
        </Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={loginForm.onSubmit(handleSignIn)}>
          <Stack>
            <TextInput
              label="Username"
              placeholder="Enter your username"
              leftSection={<IconUser size={16} />}
              required
              {...loginForm.getInputProps('username')}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              leftSection={<IconLock size={16} />}
              required
              {...loginForm.getInputProps('password')}
            />

            <Button type="submit" fullWidth loading={loading}>
              Sign In
            </Button>
          </Stack>
        </form>

        <Divider my="md" />

        <Group justify="space-between" mt="md">
          <Anchor size="sm" onClick={openSignUpModal}>
            Create account
          </Anchor>
          <Anchor size="sm" onClick={openForgotPasswordModal}>
            Forgot password?
          </Anchor>
        </Group>
      </Paper>

      {/* Sign Up Modal */}
      <Modal opened={signUpModalOpened} onClose={closeSignUpModal} title="Create Account" size="md">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={signUpForm.onSubmit(handleSignUp)}>
          <Stack>
            <TextInput
              label="Username"
              placeholder="Choose a username"
              leftSection={<IconUser size={16} />}
              required
              {...signUpForm.getInputProps('username')}
            />

            <TextInput
              label="Email"
              placeholder="Enter your email"
              leftSection={<IconMail size={16} />}
              required
              {...signUpForm.getInputProps('email')}
            />

            <TextInput
              label="Full Name"
              placeholder="Enter your full name"
              required
              {...signUpForm.getInputProps('name')}
            />

            <PasswordInput
              label="Password"
              placeholder="Choose a password"
              leftSection={<IconLock size={16} />}
              required
              {...signUpForm.getInputProps('password')}
            />

            <PasswordInput
              label="Confirm Password"
              placeholder="Confirm your password"
              leftSection={<IconLock size={16} />}
              required
              {...signUpForm.getInputProps('confirmPassword')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={closeSignUpModal}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Create Account
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal opened={confirmModalOpened} onClose={closeConfirmModal} title="Verify Your Account">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <Text size="sm" mb="md">
          Please enter the 6-digit verification code sent to your email.
        </Text>

        <Stack>
          <PinInput
            length={6}
            value={confirmationCode}
            onChange={setConfirmationCode}
            placeholder="○"
            size="lg"
            style={{ alignSelf: 'center' }}
          />

          <Group justify="space-between" mt="md">
            <Anchor size="sm" onClick={handleResendCode}>
              Resend code
            </Anchor>
            <Group>
              <Button variant="outline" onClick={closeConfirmModal}>
                Cancel
              </Button>
              <Button onClick={handleConfirmSignUp} loading={loading}>
                Verify
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Forgot Password Modal */}
      <Modal opened={forgotPasswordModalOpened} onClose={closeForgotPasswordModal} title="Reset Password">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <Text size="sm" mb="md">
          Enter your username to receive a password reset code.
        </Text>

        <form onSubmit={forgotPasswordForm.onSubmit(handleForgotPassword)}>
          <Stack>
            <TextInput
              label="Username"
              placeholder="Enter your username"
              leftSection={<IconUser size={16} />}
              required
              {...forgotPasswordForm.getInputProps('username')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={closeForgotPasswordModal}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Send Reset Code
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal opened={resetPasswordModalOpened} onClose={closeResetPasswordModal} title="Set New Password">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <Text size="sm" mb="md">
          Enter the verification code sent to your email and choose a new password.
        </Text>

        <form onSubmit={resetPasswordForm.onSubmit(handleResetPassword)}>
          <Stack>
            <TextInput
              label="Verification Code"
              placeholder="Enter 6-digit code"
              required
              {...resetPasswordForm.getInputProps('code')}
            />

            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              leftSection={<IconLock size={16} />}
              required
              {...resetPasswordForm.getInputProps('newPassword')}
            />

            <PasswordInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              leftSection={<IconLock size={16} />}
              required
              {...resetPasswordForm.getInputProps('confirmPassword')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={closeResetPasswordModal}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Reset Password
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* New Password Modal (First-time login) */}
      <Modal opened={newPasswordModalOpened} onClose={() => {}} title="Set New Password" closeOnClickOutside={false}>
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <Text size="sm" mb="md">
          You must set a new password before continuing.
        </Text>

        <form onSubmit={newPasswordForm.onSubmit(handleSetNewPassword)}>
          <Stack>
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              leftSection={<IconLock size={16} />}
              required
              {...newPasswordForm.getInputProps('newPassword')}
            />

            <PasswordInput
              label="Confirm New Password"
              placeholder="Confirm new password"
              leftSection={<IconLock size={16} />}
              required
              {...newPasswordForm.getInputProps('confirmPassword')}
            />

            <Button type="submit" fullWidth loading={loading} mt="md">
              Set Password
            </Button>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
} 