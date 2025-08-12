import axios from 'axios';
import { useAuth } from '../auth/AuthContext';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev';

// Creates an axios instance that attaches Cognito ID token if available
export function useApiClient() {
  const { getIdToken } = useAuth();

  const instance = axios.create({ baseURL: API_BASE_URL });

  instance.interceptors.request.use(async (config) => {
    const token = await getIdToken();
    if (token) {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`
      } as any;
    }
    return config;
  });

  return instance;
}
