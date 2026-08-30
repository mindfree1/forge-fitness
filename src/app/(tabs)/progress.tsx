import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/components/Card';
import { MetricTile } from '@/components/MetricTile';
import { ProgressSparkline } from '@/components/ProgressSparkline';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { useFitness } from '@/context/FitnessProvider';
import { getCompletedWorkoutCountSince, getPersonalBestHistory, getStrengthTrends } from '@/lib/db';
import { colors, radii } from '@/lib/theme';
import type { PersonalBestHistoryItem, StrengthTrend } from '@/lib/types';

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatShortDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }).toUpperCase();
}

export default function ProgressScreen() {
  const { weights, latestWeight } = useFitness();
  const [trends, setTrends] = useState<StrengthTrend[]>([]);
  const [pbs, setPbs] = useState<PersonalBestHistoryItem[]>([]);
  const [sessions, setSessions] = useState(0);
  const values = weights.map((entry) => entry.weightKg);
  const current = latestWeight?.weightKg ?? null;
  const start = weights[0]?.weightKg ?? null;
  const delta = current != null && start != null ? current - start : null;

  useFocusEffect(useCallback(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    Promise.all([
      getStrengthTrends(3),
      getPersonalBestHistory(100),
      getCompletedWorkoutCountSince(thirtyDaysAgo.toISOString()),
    ]).then(([nextTrends, nextPbs, nextSessions]) => {
      setTrends(nextTrends);
      setPbs(nextPbs);
      setSessions(nextSessions);
    }).catch(() => undefined);
  }, []));

  const recentPbExercises = useMemo(() => {
    const names: string[] = [];
    for (const pb of pbs) {
      if (!names.includes(pb.exerciseName)) names.push(pb.exerciseName);
      if (names.length === 3) break;
    }
    return names;
  }, [pbs]);

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Progress</Eyebrow>
        <Title>Proof of work.</Title>
        <Body style={{ marginTop: 8 }}>Trends matter more than any single session.</Body>
      </View>

      <View style={styles.metricRow}>
        <MetricTile label="Current" value={current == null ? '—' : current.toFixed(1)} suffix={current == null ? undefined : 'kg'} detail={delta == null ? 'No weigh-ins yet' : `${delta.toFixed(1)} kg from start`} />
        <MetricTile label="Sessions" value={String(sessions)} detail="Last 30 days" accent />
      </View>

      <View style={styles.sectionHead}><SectionTitle>Body weight</SectionTitle><Text style={styles.meta}>{weights.length} entries</Text></View>
      <Card>
        {current == null ? (
          <View>
            <Text style={styles.emptyTitle}>No weigh-ins yet</Text>
            <Body style={{ marginTop: 5 }}>Log your first weight from Today and Forge will build the trend from there.</Body>
          </View>
        ) : (
          <>
            <View style={styles.chartHead}>
              <View><Text style={styles.chartValue}>{current.toFixed(1)} kg</Text><Text style={styles.chartLabel}>LATEST WEIGH-IN</Text></View>
              <View style={styles.deltaPill}><MaterialCommunityIcons name={(delta ?? 0) <= 0 ? 'trending-down' : 'trending-up'} size={15} color={colors.accent} /><Text style={styles.deltaText}>{(delta ?? 0).toFixed(1)} kg</Text></View>
            </View>
            <ProgressSparkline values={values.length > 1 ? values : [current]} />
            <View style={styles.axis}><Text style={styles.axisText}>{formatShortDate(weights[0]?.recordedAt)}</Text><Text style={styles.axisText}>{formatShortDate(latestWeight?.recordedAt)}</Text></View>
          </>
        )}
      </Card>

      <View style={styles.sectionHead}><SectionTitle>Strength trend</SectionTitle><Text style={styles.meta}>From your sets</Text></View>
      <View style={styles.strengthList}>
        {trends.length === 0 && <Card><Text style={styles.emptyTitle}>Log a few sessions</Text><Body style={{ marginTop: 5 }}>Forge will calculate lift trends automatically from completed working sets.</Body></Card>}
        {trends.map((item) => {
          const fill = Math.max(12, Math.min(100, 45 + item.changePct * 2));
          return (
            <Card key={item.exerciseSlug} style={styles.strengthCard}>
              <View style={styles.strengthHead}>
                <View><Text style={styles.liftName}>{item.exerciseName}</Text><Text style={styles.liftMeta}>{formatNumber(item.fromKg)} kg → {formatNumber(item.currentKg)} kg</Text></View>
                <Text style={styles.change}>{item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(1)}%</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${fill}%` }]} /></View>
            </Card>
          );
        })}
      </View>

      <View style={styles.sectionHead}><SectionTitle>Personal bests</SectionTitle><Text style={styles.meta}>All time</Text></View>
      <Pressable onPress={() => router.push('/pb-history')}>
        <Card style={styles.pbRow}>
          <View style={styles.pbIcon}><MaterialCommunityIcons name="trophy-outline" size={22} color={colors.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.liftName}>{pbs.length ? `${pbs.length} PB records` : 'PB history'}</Text>
            <Text style={styles.liftMeta}>{recentPbExercises.length ? recentPbExercises.join(' · ') : 'Your records will appear here'}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={21} color={colors.faint} />
        </Card>
      </Pressable>
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
  strengthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  liftName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  liftMeta: { color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 4 },
  change: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.surface3, marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  pbRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pbIcon: { height: 44, width: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
});