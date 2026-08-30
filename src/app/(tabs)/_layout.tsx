import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { colors } from '@/lib/theme';

const icon = (name: keyof typeof MaterialCommunityIcons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          position: 'absolute',
          height: 82,
          paddingTop: 10,
          paddingBottom: 16,
          backgroundColor: '#10120F',
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('view-dashboard-outline') }} />
      <Tabs.Screen name="train" options={{ title: 'Train', tabBarIcon: icon('dumbbell') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('chart-timeline-variant') }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: icon('target') }} />
    </Tabs>
  );
}
