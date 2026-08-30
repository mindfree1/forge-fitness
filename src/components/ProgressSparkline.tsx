import { StyleSheet, View } from 'react-native';
import { colors } from '@/lib/theme';

export function ProgressSparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.1);
  return (
    <View style={styles.chart}>
      <View style={styles.gridA} />
      <View style={styles.gridB} />
      {values.map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 10 + ((max - value) / range) * 70;
        return <View key={`${index}-${value}`} style={[styles.point, { left: `${x}%`, top: `${y}%` }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: 120, position: 'relative', marginTop: 8, marginRight: 8 },
  gridA: { position: 'absolute', left: 0, right: 0, top: '33%', height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  gridB: { position: 'absolute', left: 0, right: 0, top: '67%', height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  point: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.surface, marginLeft: -5, marginTop: -5 },
});
