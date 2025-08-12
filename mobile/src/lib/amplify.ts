import { Amplify } from 'aws-amplify';

const userPoolId = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || 'eu-west-2_uZhfIxAA7';
const userPoolClientId = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '24a2n8fjsq4tvrtfdgtqkp71fl';

const cognitoConfig = {
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      signUpVerificationMethod: 'code' as const,
      loginWith: { email: true, username: false }
    }
  }
};

export function configureAmplify() {
  Amplify.configure(cognitoConfig);
}
