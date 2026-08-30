import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { MetricTile } from '@/components/MetricTile';
import { ProgressSparkline } from '@/components/ProgressSparkline';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { useFitness } from '@/context/FitnessProvider';
import { colors, radii } from '@/lib/theme';

const strength = [
  { name: 'DB Bench Press', from: '12.5 kg', current: '15 kg', progress: 0.6, change: '+20%' },
  { name: 'Lat Pulldown', from: '45 kg', current: '52.5 kg', progress: 0.72, change: '+16.7%' },
  { name: 'Romanian Deadlift', from: '50 kg', current: '65 kg', progress: 0.78, change: '+30%' },
];

export default function ProgressScreen() {
  const { weights, latestWeight } = useFitness();
  const values = weights.map((entry) => entry.weightKg);
  const current = latestWeight?.weightKg ?? 72.8;
  const start = weights[0]?.weightKg ?? 73.8;

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Progress</Eyebrow>
        <Title>Proof of work.</Title>
        <Body style={{ marginTop: 8 }}>Trends matter more than any single session.</Body>
      </View>

      <View style={styles.metricRow}>
        <MetricTile label="Current" value={current.toFixed(1)} suffix="kg" detail={`${(current - start).toFixed(1)} kg from start`} />
        <MetricTile label="Sessions" value="14" detail="Last 30 days" accent />
      </View>

      <View style={styles.sectionHead}><SectionTitle>Body weight</SectionTitle><Text style={styles.meta}>6 weeks</Text></View>
      <Card>
        <View style={styles.chartHead}>
          <View><Text style={styles.chartValue}>{current.toFixed(1)} kg</Text><Text style={styles.chartLabel}>LATEST WEIGH-IN</Text></View>
          <View style={styles.deltaPill}><MaterialCommunityIcons name="trending-down" size={15} color={colors.accent} /><Text style={styles.deltaText}>{(current - start).toFixed(1)} kg</Text></View>
        </View>
        <ProgressSparkline values={values.length > 1 ? values : [73.8, 73.5, 73.2, current]} />
        <View style={styles.axis}><Text style={styles.axisText}>JUL 13</Text><Text style={styles.axisText}>AUG 24</Text></View>
      </Card>

      <View style={styles.sectionHead}><SectionTitle>Strength trend</SectionTitle><Text style={styles.meta}>Top lifts</Text></View>
      <View style={styles.strengthList}>
        {strength.map((item) => (
          <Card key={item.name} style={styles.strengthCard}>
            <View style={styles.strengthHead}>
              <View><Text style={styles.liftName}>{item.name}</Text><Text style={styles.liftMeta}>{item.from} → {item.current}</Text></View>
              <Text style={styles.change}>{item.change}</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${item.progress * 100}%` }]} /></View>
          </Card>
        ))}
      </View>

      <View style={styles.sectionHead}><SectionTitle>Personal bests</SectionTitle><Text style={styles.meta}>August</Text></View>
      <Card style={styles.pbRow}>
        <View style={styles.pbIcon}><MaterialCommunityIcons name="trophy-outline" size={22} color={colors.accent} /></View>
        <View style={{ flex: 1 }}><Text style={styles.liftName}>3 new PBs</Text><Text style={styles.liftMeta}>Bench · RDL · Lat pulldown</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={21} color={colors.faint} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 10, marginBottom: 24 },
  metricRow: { flexDirection: 'row', gap: 10 },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: colors.faint, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartValue: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  chartLabel: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentSoft, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 6 },
  deltaText: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { color: colors.faint, fontSize: 8, fontWeight: '800' },
  strengthList: { gap: 9 },
  strengthCard: { padding: 15 },
  strengthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liftName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  liftMeta: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 4 },
  change: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.surface3, marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  pbRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pbIcon: { height: 44, width: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
