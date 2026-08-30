import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AnalyticsCard,
  AnalyticsCardHeader,
  AnalyticsEmptyState,
  AnalyticsErrorState,
  AnalyticsSkeleton,
  BarChart,
  InsightRow,
  LineChart,
  MetricSelectPill,
  MuscleBalanceBars,
  OptionPickerModal,
  ProgressRangeSelector,
  RecentAchievementStrip,
} from '@/components/progress/AnalyticsPrimitives';
import { Screen } from '@/components/Screen';
import {
  getBodyweightSeries,
  getMuscleGroupVolume,
  getRangeDescriptor,
  getRecentAchievements,
  getStrengthExerciseOptions,
  getStrengthMetricLabel,
  getStrengthSeries,
  getTrainingConsistency,
  getTrainingSpanSummary,
  type BodyweightSeries,
  type MuscleVolumeRow,
  type ProgressRange,
  type RecentAchievement,
  type StrengthExerciseOption,
  type StrengthMetric,
  type StrengthSeriesPoint,
  type TrainingConsistency,
} from '@/lib/analytics';
import { colors, radii } from '@/lib/theme';

const blue = '#6D9CFF';

type DashboardErrors = Partial<Record<'summary' | 'consistency' | 'strength' | 'bodyweight' | 'achievements' | 'muscles', boolean>>;

type Captured<T> = { value: T | null; error: boolean };

async function capture<T>(label: string, promise: Promise<T>): Promise<Captured<T>> {
  try {
    return { value: await promise, error: false };
  } catch (error) {
    console.error(`[Progress v4] ${label} failed`, error);
    return { value: null, error: true };
  }
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatOneDecimal(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function formatStrengthValue(metric: StrengthMetric, value: number) {
  if (metric === 'volume') return `${Math.round(value).toLocaleString('en-AU')} kg`;
  return `${formatOneDecimal(value)} kg`;
}

function strengthInsight(metric: StrengthMetric, points: StrengthSeriesPoint[]) {
  if (!points.length) return null;
  if (points.length === 1) return `Complete another session to build a ${getStrengthMetricLabel(metric)} trend.`;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (first <= 0) return null;
  const change = ((last - first) / first) * 100;
  const direction = change >= 0 ? 'up' : 'down';
  return `${getStrengthMetricLabel(metric)} is ${direction} ${Math.abs(change).toFixed(1)}% over ${points.length} sessions.`;
}

function bodyweightSummary(range: ProgressRange, series: BodyweightSeries) {
  if (series.points.length < 2) return series.points.length === 1 ? 'Add another weigh-in to build a trend' : 'No weigh-ins in this range';
  const first = series.points[0].value;
  const last = series.points[series.points.length - 1].value;
  const delta = last - first;
  if (Math.abs(delta) < 0.05) return `stable across ${getRangeDescriptor(range).toLowerCase()}`;
  return `${delta < 0 ? 'down' : 'up'} ${Math.abs(delta).toFixed(1)} kg in ${getRangeDescriptor(range).replace('Last ', '').toLowerCase()}`;
}

export default function ProgressScreen() {
  const [range, setRange] = useState<ProgressRange>('12W');
  const [strengthMetric, setStrengthMetric] = useState<StrengthMetric>('e1rm');
  const [strengthExerciseSlug, setStrengthExerciseSlug] = useState<string | null>(null);
  const [summary, setSummary] = useState('Loading training history…');
  const [consistency, setConsistency] = useState<TrainingConsistency | null>(null);
  const [strengthOptions, setStrengthOptions] = useState<StrengthExerciseOption[]>([]);
  const [strengthPoints, setStrengthPoints] = useState<StrengthSeriesPoint[]>([]);
  const [bodyweight, setBodyweight] = useState<BodyweightSeries | null>(null);
  const [achievements, setAchievements] = useState<RecentAchievement[]>([]);
  const [muscles, setMuscles] = useState<MuscleVolumeRow[]>([]);
  const [errors, setErrors] = useState<DashboardErrors>({});
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);
  const requestId = useRef(0);

  const loadDashboard = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);

    const optionsResult = await capture('strength exercise options', getStrengthExerciseOptions());
    if (id !== requestId.current) return;

    const options = optionsResult.value ?? [];
    const selectedStillExists = strengthExerciseSlug && options.some((option) => option.slug === strengthExerciseSlug);
    const effectiveExercise = selectedStillExists ? strengthExerciseSlug : options[0]?.slug ?? null;

    const [summaryResult, consistencyResult, bodyweightResult, achievementsResult, musclesResult, strengthResult] = await Promise.all([
      capture('training span', getTrainingSpanSummary()),
      capture('training consistency', getTrainingConsistency(range)),
      capture('bodyweight', getBodyweightSeries(range)),
      capture('recent achievements', getRecentAchievements(range, 6)),
      capture('muscle volume', getMuscleGroupVolume(range)),
      effectiveExercise
        ? capture('strength series', getStrengthSeries(effectiveExercise, strengthMetric, range))
        : Promise.resolve<Captured<StrengthSeriesPoint[]>>({ value: [], error: optionsResult.error }),
    ]);

    if (id !== requestId.current) return;

    setStrengthOptions(options);
    if (effectiveExercise !== strengthExerciseSlug) setStrengthExerciseSlug(effectiveExercise);
    setSummary(summaryResult.value ?? 'Progress data unavailable');
    setConsistency(consistencyResult.value);
    setBodyweight(bodyweightResult.value);
    setAchievements(achievementsResult.value ?? []);
    setMuscles(musclesResult.value ?? []);
    setStrengthPoints(strengthResult.value ?? []);
    setErrors({
      summary: summaryResult.error,
      consistency: consistencyResult.error,
      bodyweight: bodyweightResult.error,
      achievements: achievementsResult.error,
      muscles: musclesResult.error,
      strength: optionsResult.error || strengthResult.error,
    });
    setLoading(false);
  }, [range, reloadToken, strengthExerciseSlug, strengthMetric]);

  useFocusEffect(useCallback(() => {
    void loadDashboard();
    return () => { requestId.current += 1; };
  }, [loadDashboard]));

  const selectedStrengthExercise = useMemo(
    () => strengthOptions.find((option) => option.slug === strengthExerciseSlug) ?? null,
    [strengthExerciseSlug, strengthOptions],
  );

  const strengthChange = useMemo(() => {
    if (strengthPoints.length < 2 || strengthPoints[0].value <= 0) return null;
    const first = strengthPoints[0].value;
    const last = strengthPoints[strengthPoints.length - 1].value;
    return ((last - first) / first) * 100;
  }, [strengthPoints]);

  const bodyweightPoints = bodyweight?.points ?? [];
  const bodyweightHeadline = bodyweightPoints.at(-1)?.value ?? bodyweight?.latestKnown?.value ?? null;
  const muscleInsight = muscles.length >= 2 ? `${muscles[0].muscle} and ${muscles[1].muscle.toLowerCase()} lead your ${getRangeDescriptor(range).toLowerCase()}.` : null;

  const retry = () => setReloadToken((value) => value + 1);

  return (
    <Screen contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your Progress</Text>
          <Text style={styles.subtitle}>{summary}</Text>
        </View>
        <View style={styles.filterIcon}>
          <MaterialCommunityIcons name="tune-variant" size={23} color={colors.text} />
        </View>
      </View>

      <ProgressRangeSelector value={range} onChange={setRange} />

      <View style={styles.cards}>
        <AnalyticsCard>
          <AnalyticsCardHeader
            icon="chart-bar"
            title="Training consistency"
            subtitle={consistency ? `${consistency.sessionsPerWeek.toFixed(1)} sessions / week` : 'Completed workouts'}
            accent={blue}
            right={<MetricSelectPill label="Workouts" accent={blue} />}
          />
          {loading && !consistency ? <AnalyticsSkeleton height={126} /> : errors.consistency ? <AnalyticsErrorState onRetry={retry} /> : !consistency?.totalSessions ? (
            <AnalyticsEmptyState title="No completed workouts yet" detail="Finish a workout and Forge will build your consistency trend here." />
          ) : (
            <BarChart points={consistency.buckets.map((bucket) => ({ label: bucket.label, value: bucket.value }))} accent={blue} />
          )}
        </AnalyticsCard>

        <AnalyticsCard>
          <AnalyticsCardHeader
            icon="dumbbell"
            title={selectedStrengthExercise?.name ?? 'Strength progression'}
            subtitle={strengthMetric === 'e1rm' ? 'Estimated 1RM' : getStrengthMetricLabel(strengthMetric)}
            onTitlePress={strengthOptions.length ? () => setExercisePickerOpen(true) : undefined}
            right={<MetricSelectPill label={getStrengthMetricLabel(strengthMetric)} onPress={() => setMetricPickerOpen(true)} />}
          />
          {loading && !strengthPoints.length ? <AnalyticsSkeleton height={172} /> : errors.strength ? <AnalyticsErrorState onRetry={retry} /> : !selectedStrengthExercise ? (
            <AnalyticsEmptyState title="Log weighted working sets" detail="Complete sets with weight and reps to unlock strength trends." />
          ) : !strengthPoints.length ? (
            <AnalyticsEmptyState title={`No ${getStrengthMetricLabel(strengthMetric)} data in this range`} detail="Try a longer range or complete another session for this exercise." />
          ) : (
            <>
              <View style={styles.heroMetricRow}>
                <Text style={styles.heroMetric}>{formatStrengthValue(strengthMetric, strengthPoints[strengthPoints.length - 1].value)}</Text>
                {strengthChange != null ? (
                  <View style={styles.changePill}>
                    <MaterialCommunityIcons name={strengthChange >= 0 ? 'arrow-up' : 'arrow-down'} size={13} color={colors.accent} />
                    <Text style={styles.changeText}>{Math.abs(strengthChange).toFixed(1)}%</Text>
                  </View>
                ) : null}
              </View>
              <LineChart points={strengthPoints.map((point) => ({ label: shortDate(point.date), value: point.value }))} />
              {strengthInsight(strengthMetric, strengthPoints) ? <InsightRow text={strengthInsight(strengthMetric, strengthPoints)!} /> : null}
            </>
          )}
        </AnalyticsCard>

        <AnalyticsCard>
          <AnalyticsCardHeader
            icon="scale-bathroom"
            title="Bodyweight"
            subtitle={bodyweight ? bodyweightSummary(range, bodyweight) : 'Weight trend'}
            accent={blue}
            right={<MetricSelectPill label="kg" accent={blue} />}
          />
          {loading && !bodyweight ? <AnalyticsSkeleton height={150} /> : errors.bodyweight ? <AnalyticsErrorState onRetry={retry} /> : bodyweightHeadline == null ? (
            <AnalyticsEmptyState title="No weigh-ins yet" detail="Add a weigh-in from Today to start your bodyweight trend." />
          ) : (
            <>
              <Text style={[styles.heroMetric, { color: blue }]}>{bodyweightHeadline.toFixed(1)} kg</Text>
              {bodyweightPoints.length ? (
                <LineChart points={bodyweightPoints.map((point) => ({ label: shortDate(point.date), value: point.value }))} accent={blue} />
              ) : (
                <AnalyticsEmptyState title="No weigh-ins in this range" detail="Your latest known weight is shown above. Add a new weigh-in to populate this chart." />
              )}
            </>
          )}
        </AnalyticsCard>

        <AnalyticsCard>
          <AnalyticsCardHeader
            icon="trophy-outline"
            title="Recent PBs"
            right={(
              <Pressable onPress={() => router.push('/pb-history')} hitSlop={10}>
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            )}
          />
          {loading && !achievements.length ? <AnalyticsSkeleton height={90} /> : errors.achievements ? <AnalyticsErrorState onRetry={retry} /> : !achievements.length ? (
            <AnalyticsEmptyState title="No PBs in this range" detail="New records from real completed sets will appear here." />
          ) : <RecentAchievementStrip items={achievements} />}
        </AnalyticsCard>

        <AnalyticsCard>
          <AnalyticsCardHeader
            icon="chart-donut"
            title="Muscle balance"
            subtitle={getRangeDescriptor(range)}
            right={<MetricSelectPill label="Volume" />}
          />
          {loading && !muscles.length ? <AnalyticsSkeleton height={180} /> : errors.muscles ? <AnalyticsErrorState onRetry={retry} /> : !muscles.length ? (
            <AnalyticsEmptyState title="No weighted volume yet" detail="Complete weighted working sets and Forge will show where your training volume is going." />
          ) : (
            <>
              <MuscleBalanceBars rows={muscles} />
              {muscleInsight ? <InsightRow text={muscleInsight} /> : null}
            </>
          )}
        </AnalyticsCard>
      </View>

      <OptionPickerModal
        visible={exercisePickerOpen}
        title="Strength exercise"
        options={strengthOptions.map((option) => ({ label: option.name, value: option.slug }))}
        selectedValue={strengthExerciseSlug}
        onSelect={setStrengthExerciseSlug}
        onClose={() => setExercisePickerOpen(false)}
      />
      <OptionPickerModal
        visible={metricPickerOpen}
        title="Strength metric"
        options={[
          { label: 'e1RM', value: 'e1rm' },
          { label: 'Max Weight', value: 'maxWeight' },
          { label: 'Volume', value: 'volume' },
        ]}
        selectedValue={strengthMetric}
        onSelect={(value) => setStrengthMetric(value as StrengthMetric)}
        onClose={() => setMetricPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 14, paddingBottom: 130 },
  header: { paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  filterIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cards: { gap: 12 },
  heroMetricRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroMetric: { color: colors.accent, fontSize: 29, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, marginTop: 10 },
  changePill: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.accentSoft },
  changeText: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  viewAll: { color: colors.accent, fontSize: 12, fontWeight: '800', paddingVertical: 8 },
});
