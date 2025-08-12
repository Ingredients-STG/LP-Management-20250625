import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator();
const queryClient = new QueryClient();

export default function App() {
  const scheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'LP Management' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
