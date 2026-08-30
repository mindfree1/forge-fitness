import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FitnessProvider } from '@/context/FitnessProvider';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <FitnessProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exercise/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="programs" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="workout-template/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="pb-history" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </FitnessProvider>
  );
}
