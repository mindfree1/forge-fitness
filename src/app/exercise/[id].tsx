import { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { getPersonalBests, getWorkoutSets, saveWorkoutSet, startWorkout } from '@/lib/db';
import { todayWorkout } from '@/lib/seed';
import { colors, radii } from '@/lib/theme';
import type { PersonalBest } from '@/lib/types';

type SetRow = { kg: string; reps: string; complete: boolean };

const REST_SECONDS = 90;

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useMemo(() => todayWorkout.exercises.find((item) => item.id === id) ?? todayWorkout.exercises[0], [id]);
  const initialSets = useMemo<SetRow[]>(() => exercise.previous.map((entry) => {
    const [kg, reps] = entry.split(' × ');
    return { kg, reps, complete: false };
  }), [exercise]);

  const [sets, setSets] = useState<SetRow[]>(initialSets);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [newPbMetrics, setNewPbMetrics] = useState<PersonalBest['metric'][]>([]);
  const [restRemaining, setRestRemaining] = useState(REST_SECONDS);
  const [restRunning, setRestRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const workout = await startWorkout(todayWorkout.title);
      const [persistedSets, pbs] = await Promise.all([
        getWorkoutSets(workout.id, exercise.id),
        getPersonalBests(exercise.id),
      ]);
      if (cancelled) return;
      setWorkoutId(workout.id);
      setPersonalBests(pbs);
      if (persistedSets.length) {
        setSets(persistedSets.map((set) => ({
          kg: set.weightKg == null ? '' : formatNumber(set.weightKg),
          reps: set.reps == null ? '' : String(set.reps),
          complete: set.completed,
        })));
      } else {
        setSets(initialSets);
      }
    };
    load().catch(() => undefined);
    return () => { cancelled = true; };
  }, [exercise.id, initialSets]);

  useEffect(() => {
    if (!restRunning) return;
    const interval = setInterval(() => {
      setRestRemaining((current) => {
        if (current <= 1) {
          setRestRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restRunning]);

  const refreshPbs = async () => {
    const pbs = await getPersonalBests(exercise.id);
    setPersonalBests(pbs);
  };

  const updateSet = (index: number, field: 'kg' | 'reps', value: string) => {
    setSets((current) => current.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set));
  };

  const persistSet = async (index: number, row: SetRow) => {
    if (!workoutId) return [];
    const weightKg = row.kg.trim() === '' ? null : Number(row.kg);
    const reps = row.reps.trim() === '' ? null : Number(row.reps);
    if ((weightKg !== null && !Number.isFinite(weightKg)) || (reps !== null && !Number.isFinite(reps))) return [];
    return saveWorkoutSet({
      workoutId,
      exerciseSlug: exercise.id,
      setNumber: index + 1,
      weightKg,
      reps,
      completed: row.complete,
    });
  };

  const toggleComplete = async (index: number) => {
    const current = sets[index];
    const next = { ...current, complete: !current.complete };
    Haptics.selectionAsync().catch(() => undefined);
    setSets((rows) => rows.map((set, setIndex) => setIndex === index ? next : set));

    const achieved = await persistSet(index, next);
    if (next.complete) {
      setRestRemaining(REST_SECONDS);
      setRestRunning(true);
    }
    if (achieved.length) {
      setNewPbMetrics(achieved);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await refreshPbs();
    }
  };

  const addSet = () => {
    setSets((current) => [...current, { kg: '', reps: '', complete: false }]);
  };

  const weightPb = personalBests.find((pb) => pb.metric === 'weight');
  const e1rmPb = personalBests.find((pb) => pb.metric === 'e1rm');
  const pbHeadline = weightPb ? `${formatNumber(weightPb.value)} kg max set` : 'Set your baseline';
  const pbSubline = e1rmPb ? `Estimated 1RM ${formatNumber(e1rmPb.value)} kg` : 'Complete a working set to start PB tracking';

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable>
        <Text style={styles.navTitle}>Exercise</Text>
        <Pressable style={styles.navButton}><MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.text} /></Pressable>
      </View>

      <Eyebrow>{exercise.muscle}</Eyebrow>
      <Title style={{ marginTop: 6 }}>{exercise.name}</Title>
      <Body style={{ marginTop: 9 }}>{exercise.equipment} · Target {exercise.target}</Body>

      {newPbMetrics.length > 0 && (
        <View style={styles.pbCelebration}>
          <MaterialCommunityIcons name="trophy" size={18} color={colors.bg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pbCelebrationTitle}>New personal best</Text>
            <Text style={styles.pbCelebrationCopy}>{newPbMetrics.map((metric) => metric.toUpperCase()).join(' · ')}</Text>
          </View>
          <Pressable onPress={() => setNewPbMetrics([])}><MaterialCommunityIcons name="close" size={18} color={colors.bg} /></Pressable>
        </View>
      )}

      <Card style={styles.performanceCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.micro}>CURRENT PB</Text>
          <Text style={styles.big}>{pbHeadline}</Text>
          <Text style={styles.pbSubline}>{pbSubline}</Text>
        </View>
        <View style={styles.pbBadge}><MaterialCommunityIcons name="trophy" size={21} color={colors.bg} /></View>
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Working sets</SectionTitle>
        <View style={styles.timerWrap}>
          <Pressable onPress={() => restRemaining > 0 && setRestRunning((current) => !current)} style={styles.timerButton}>
            <MaterialCommunityIcons name={restRunning ? 'pause' : 'play'} size={13} color={colors.accent} />
            <Text style={styles.rest}>REST {formatTimer(restRemaining)}</Text>
          </Pressable>
          <Pressable onPress={() => { setRestRemaining(REST_SECONDS); setRestRunning(false); }} style={styles.resetButton}>
            <MaterialCommunityIcons name="refresh" size={14} color={colors.faint} />
          </Pressable>
        </View>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.columnHead, { width: 42 }]}>SET</Text>
        <Text style={[styles.columnHead, { flex: 1 }]}>PREVIOUS</Text>
        <Text style={[styles.columnHead, { width: 72, textAlign: 'center' }]}>KG</Text>
        <Text style={[styles.columnHead, { width: 64, textAlign: 'center' }]}>REPS</Text>
        <View style={{ width: 42 }} />
      </View>
      <View style={styles.setList}>
        {sets.map((set, index) => (
          <View key={index} style={[styles.setRow, set.complete && styles.setComplete]}>
            <Text style={styles.setNumber}>{index + 1}</Text>
            <Text style={styles.previous}>{exercise.previous[index] ?? '—'}</Text>
            <TextInput
              value={set.kg}
              onChangeText={(value) => updateSet(index, 'kg', value)}
              onEndEditing={() => persistSet(index, sets[index]).catch(() => undefined)}
              keyboardType="decimal-pad"
              style={styles.setInput}
              selectTextOnFocus
            />
            <TextInput
              value={set.reps}
              onChangeText={(value) => updateSet(index, 'reps', value)}
              onEndEditing={() => persistSet(index, sets[index]).catch(() => undefined)}
              keyboardType="number-pad"
              style={styles.repInput}
              selectTextOnFocus
            />
            <Pressable onPress={() => toggleComplete(index)} style={[styles.check, set.complete && styles.checkDone]}>
              {set.complete && <MaterialCommunityIcons name="check" size={17} color={colors.bg} />}
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable onPress={addSet} style={styles.addSet}>
        <MaterialCommunityIcons name="plus" size={18} color={colors.accent} /><Text style={styles.addSetText}>Add set</Text>
      </Pressable>

      <View style={styles.sectionHead}><SectionTitle>Technique</SectionTitle><Text style={styles.rest}>VIDEO NEXT</Text></View>
      <Card style={styles.techniqueCard}>
        <View style={styles.videoPlaceholder}>
          <View style={styles.play}><MaterialCommunityIcons name="play" size={24} color={colors.bg} /></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.techniqueTitle}>Keep the rep clean</Text>
          <Body>Retract shoulder blades, keep elbows around 45°, and lower under control.</Body>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, marginBottom: 25 },
  navButton: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  pbCelebration: { marginTop: 20, borderRadius: radii.md, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  pbCelebrationTitle: { color: colors.bg, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  pbCelebrationCopy: { color: colors.bg, opacity: 0.72, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 2 },
  performanceCard: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  micro: { color: colors.faint, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  big: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  pbSubline: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  pbBadge: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerButton: { minHeight: 30, paddingHorizontal: 8, borderRadius: radii.pill, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  resetButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rest: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 7 },
  columnHead: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  setList: { gap: 7 },
  setRow: { minHeight: 58, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  setComplete: { borderColor: '#344324', backgroundColor: '#141A10' },
  setNumber: { width: 42, color: colors.muted, fontSize: 12, fontWeight: '900' },
  previous: { flex: 1, color: colors.faint, fontSize: 11, fontWeight: '700' },
  setInput: { width: 72, color: colors.text, textAlign: 'center', fontSize: 15, fontWeight: '900', paddingVertical: 10 },
  repInput: { width: 64, color: colors.text, textAlign: 'center', fontSize: 15, fontWeight: '900', paddingVertical: 10 },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  addSet: { marginTop: 10, height: 48, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  addSetText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  techniqueCard: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  videoPlaceholder: { width: 90, height: 78, borderRadius: radii.md, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  play: { height: 38, width: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  techniqueTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 5 },
});
