import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/lib/theme';

export function MetricTile({ label, value, suffix, detail, accent = false }: { label: string; value: string; suffix?: string; detail: string; accent?: boolean }) {
  return (
    <View style={[styles.tile, accent && styles.accentTile]}>
      <Text style={[styles.label, accent && styles.accentLabel]}>{label}</Text>
      <View style={styles.numberRow}>
        <Text style={[styles.value, accent && styles.accentValue]}>{value}</Text>
        {!!suffix && <Text style={[styles.suffix, accent && styles.accentLabel]}>{suffix}</Text>}
      </View>
      <Text style={[styles.detail, accent && styles.accentDetail]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 144, padding: 16, borderRadius: radii.md, backgroundColor: colors.surface2, justifyContent: 'space-between' },
  accentTile: { backgroundColor: colors.accent },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.1 },
  accentLabel: { color: '#34401E' },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  value: { color: colors.text, fontSize: 29, fontWeight: '900', letterSpacing: -1 },
  accentValue: { color: colors.bg },
  suffix: { color: colors.muted, fontSize: 12, fontWeight: '800', paddingBottom: 5 },
  detail: { color: colors.faint, fontSize: 11, fontWeight: '700' },
  accentDetail: { color: '#4B5B2B' },
});
