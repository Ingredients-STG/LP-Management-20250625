import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import AssetDetailsScreen from './src/screens/AssetDetailsScreen';
import EditAssetScreen from './src/screens/EditAssetScreen';
import CreateAssetScreen from './src/screens/CreateAssetScreen';
import BarcodeScannerScreen from './src/screens/BarcodeScannerScreen';
import { AuthProvider } from './src/auth/AuthContext';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1
    }
  }
});

export default function App() {
  const scheme = useColorScheme();
  useEffect(() => {
    const persister = createAsyncStoragePersister({ storage: AsyncStorage });
    persistQueryClient({ queryClient, persister, maxAge: 24 * 60 * 60 * 1000 });
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        queryClient.resumePausedMutations();
        queryClient.invalidateQueries();
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack.Navigator>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'LP Management' }} />
            <Stack.Screen name="AssetDetails" component={AssetDetailsScreen} options={{ title: 'Asset details' }} />
            <Stack.Screen name="EditAsset" component={EditAssetScreen} options={{ title: 'Edit asset' }} />
            <Stack.Screen name="CreateAsset" component={CreateAssetScreen} options={{ title: 'Create asset' }} />
            <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} options={{ title: 'Scan barcode' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </AuthProvider>
  );
}
