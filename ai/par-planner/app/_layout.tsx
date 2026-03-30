import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f1923' },
          headerTintColor: '#f0f0f0',
          contentStyle: { backgroundColor: '#0f1923' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Par Planner' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Build Your Profile' }} />
      </Stack>
    </>
  );
}
