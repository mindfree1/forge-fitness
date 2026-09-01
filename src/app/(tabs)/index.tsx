import { useCallback, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/components/Card';
import { MetricTile } from '@/components/MetricTile';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { WeekStrip, type WeekActivityItem } from '@/components/WeekStrip';
import { useFitness } from '@/context/FitnessProvider';
import { getActiveProgram, getPersonalBestHistory, getRecommendedWorkoutTemplate, getWorkoutHistory } from '@/lib/db';
import { colors, radii } from '@/lib/theme';
import type { PersonalBestHistoryItem, Program, WorkoutSession, WorkoutTemplate } from '@/lib/types';

function startOfWeek(date = new Date()) {
  const value = new Date(date);
  const daysFromMonday = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - daysFromMonday);
  value.setHours(0, 0, 0, 0);
  return value;
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function weekActivityFromHistory(history: WorkoutSession[]): WeekActivityItem[] {
  const start = startOfWeek();
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const done = history.some((session) => session.completedAt && sameLocalDay(new Date(session.completedAt), date));
    return {
      day: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index],
      done,
      today: sameLocalDay(today, date),
    };
  });
}

function formatPb(item: PersonalBestHistoryItem | null) {
  if (!item) return 'Complete a set to start';
  const value = Number.isInteger(item.value) ? String(item.value) : item.value.toFixed(1);
  if (item.metric === 'weight') return `${value} kg max set`;
  if (item.metric === 'reps') return `${value} reps`;
  if (item.metric === 'e1rm') return `${value} kg e1RM`;
  return `${value} kg volume`;
}

export default function TodayScreen() {
  const { weights, latestWeight, addWeight } = useFitness();
  const [weightOpen, setWeightOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [program, setProgram] = useState<Program | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [latestPb, setLatestPb] = useState<PersonalBestHistoryItem | null>(null);
  const currentWeight = latestWeight?.weightKg ?? null;
  const startingWeight = weights[0]?.weightKg ?? null;
  const weightDelta = currentWeight != null && startingWeight != null ? currentWeight - startingWeight : null;

  useFocusEffect(useCallback(() => {
    Promise.all([
      getActiveProgram(),
      getRecommendedWorkoutTemplate(),
      getWorkoutHistory(60),
      getPersonalBestHistory(1),
    ]).then(([nextProgram, nextTemplate, nextHistory, pbHistory]) => {
      setProgram(nextProgram);
      setTemplate(nextTemplate);
      setHistory(nextHistory);
      setLatestPb(pbHistory[0] ?? null);
    }).catch(() => undefined);
  }, []));

  const weekActivity = useMemo(() => weekActivityFromHistory(history), [history]);
  const sessionsThisWeek = weekActivity.filter((item) => item.done).length;
  const targetSessions = program?.targetSessionsPerWeek ?? 4;
  const dayName = new Date().toLocaleDateString('en-AU', { weekday: 'long' });

  const openWeight = () => {
    setWeight(latestWeight?.weightKg.toFixed(1) ?? '');
    setWeightOpen(true);
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <View>
          <Eyebrow>Forge · {dayName}</Eyebrow>
          <Title>Build the week.</Title>
        </View>
        <Pressable onPress={() => router.push('/programs')} style={styles.avatar}><MaterialCommunityIcons name="tune-variant" size={20} color={colors.text} /></Pressable>
      </View>

      <View style={styles.metricRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log body weight"
          onPress={openWeight}
          style={({ pressed }) => [styles.metricPressable, pressed && styles.metricPressed]}
        >
          <MetricTile
            label="Body weight"
            value={currentWeight == null ? '—' : currentWeight.toFixed(1)}
            suffix={currentWeight == null ? undefined : 'kg'}
            detail={weightDelta == null ? 'Tap to add your first weigh-in' : `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} kg from start`}
          />
          {currentWeight == null ? (
            <View style={styles.metricAddBadge}>
              <MaterialCommunityIcons name="plus" size={19} color={colors.bg} />
            </View>
          ) : null}
        </Pressable>
        <MetricTile label="Today steps" value="—" detail="Health Connect not connected" accent />
      </View>

      <Pressable onPress={openWeight} style={styles.quickAction}>
        <MaterialCommunityIcons name="plus-circle-outline" size={19} color={colors.accent} />
        <Text style={styles.quickText}>Log today's weight</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.faint} />
      </Pressable>

      <View style={styles.sectionHead}>
        <SectionTitle>This week</SectionTitle>
        <Text style={styles.sectionMeta}>{sessionsThisWeek} / {targetSessions} sessions</Text>
      </View>
      <Card>
        <View style={styles.streakRow}>
          <View>
            <Text style={styles.streakNumber}>{sessionsThisWeek}</Text>
            <Text style={styles.streakLabel}>sessions completed</Text>
          </View>
          <View style={styles.fireBadge}><MaterialCommunityIcons name="fire" size={27} color={colors.bg} /></View>
        </View>
        <WeekStrip activity={weekActivity} />
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Next session</SectionTitle>
        <Text style={styles.sectionMeta}>{template ? `${template.durationMinutes} min` : 'Set up'}</Text>
      </View>
      {template ? (
        <Card style={styles.workoutCard}>
          <View style={styles.tag}><Text style={styles.tagText}>NEXT · ROTATION</Text></View>
          <Text style={styles.workoutTitle}>{template.name}</Text>
          <Body>{template.subtitle}</Body>
          <View style={styles.workoutStats}>
            <View><Text style={styles.statValue}>{template.exerciseCount}</Text><Text style={styles.statLabel}>Exercises</Text></View>
            <View style={styles.rule} />
            <View><Text style={styles.statValue}>{template.workingSets}</Text><Text style={styles.statLabel}>Working sets</Text></View>
            <View style={styles.rule} />
            <View><Text style={styles.statValue}>{targetSessions}/wk</Text><Text style={styles.statLabel}>Training target</Text></View>
          </View>
          <PrimaryButton label="Start workout" icon="lightning-bolt" onPress={() => router.push('/train')} />
        </Card>
      ) : (
        <Card style={styles.workoutCard}>
          <Text style={styles.workoutTitle}>Create your rotation</Text>
          <Body>Choose your weekly target and build the sessions you want Forge to rotate through.</Body>
          <PrimaryButton label="Open My Program" icon="tune" onPress={() => router.push('/programs')} />
        </Card>
      )}

      <View style={styles.sectionHead}>
        <SectionTitle>Latest PB</SectionTitle>
        <Text style={styles.sectionMeta}>{latestPb ? new Date(latestPb.achievedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'No records'}</Text>
      </View>
      <Pressable onPress={() => router.push('/pb-history')}>
        <Card style={styles.pbCard}>
          <View style={styles.pbIcon}><MaterialCommunityIcons name="trophy-outline" size={24} color={colors.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pbExercise}>{latestPb?.exerciseName ?? 'Personal best history'}</Text>
            <Text style={styles.pbValue}>{formatPb(latestPb)}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={21} color={colors.faint} />
        </Card>
      </Pressable>

      <Modal visible={weightOpen} transparent animationType="fade" onRequestClose={() => setWeightOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Eyebrow>Quick log</Eyebrow>
            <SectionTitle style={{ marginTop: 8 }}>Today's weight</SectionTitle>
            <View style={styles.inputRow}>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                autoFocus
                style={styles.weightInput}
                placeholder="—"
                placeholderTextColor={colors.faint}
              />
              <Text style={styles.kg}>kg</Text>
            </View>
            <PrimaryButton
              label="Save weight"
              icon="check"
              onPress={async () => {
                const next = Number(weight);
                if (Number.isFinite(next) && next > 20 && next < 300) await addWeight(next);
                setWeightOpen(false);
              }}
            />
            <Pressable onPress={() => setWeightOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginBottom: 26 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricPressable: { flex: 1, position: 'relative' },
  metricPressed: { opacity: 0.82 },
  metricAddBadge: { position: 'absolute', top: 13, right: 13, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  quickAction: { height: 52, marginTop: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15 },
  quickText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 12 },
  sectionMeta: { color: colors.faint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  streakRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakNumber: { color: colors.text, fontSize: 35, fontWeight: '900', letterSpacing: -1 },
  streakLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  fireBadge: { height: 45, width: 45, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  workoutCard: { gap: 9 },
  tag: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 9, borderRadius: radii.pill, backgroundColor: colors.accentSoft },
  tagText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  workoutTitle: { color: colors.text, fontSize: 28, lineHeight: 32, fontWeight: '900', letterSpacing: -0.7, marginTop: 5 },
  workoutStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  statLabel: { color: colors.faint, fontSize: 9, fontWeight: '800', marginTop: 3, textTransform: 'uppercase' },
  rule: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.border },
  pbCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  pbIcon: { height: 48, width: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  pbExercise: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  pbValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 38, borderTopWidth: 1, borderColor: colors.border },
  inputRow: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 26 },
  weightInput: { flex: 1, color: colors.text, fontSize: 54, fontWeight: '900', letterSpacing: -2, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  kg: { color: colors.muted, fontSize: 17, fontWeight: '800', marginLeft: 10 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
});