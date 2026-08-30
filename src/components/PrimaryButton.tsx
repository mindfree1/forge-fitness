import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/lib/theme';

export function PrimaryButton({ label, icon = 'arrow-right', onPress }: { label: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; onPress?: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.bg} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 58, borderRadius: radii.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  label: { color: colors.bg, fontSize: 15, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  iconWrap: { height: 34, width: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
});
