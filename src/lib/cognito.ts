import { Amplify } from 'aws-amplify';

const cognitoConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'eu-west-2_uZhfIxAA7',
      userPoolClientId: '24a2n8fjsq4tvrtfdgtqkp71fl',
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
        username: false
      }
    }
  }
};

export const configureAmplify = () => {
  Amplify.configure(cognitoConfig);
};

export default cognitoConfig; 