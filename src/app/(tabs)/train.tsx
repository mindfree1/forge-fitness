import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import {
  finishWorkout,
  getActiveWorkout,
  getExerciseLibrary,
  getNextWorkoutTemplate,
  getRecommendedWorkoutTemplate,
  getWorkoutTemplate,
  startWorkout,
} from '@/lib/db';
import { getExerciseTrackingMode, isTimedTrackingMode } from '@/lib/exerciseTracking';
import {
  addExerciseToWorkout,
  getWorkoutCompletionSummary,
  getWorkoutExercisePlan,
  getWorkoutExerciseProgress,
  moveWorkoutExercise,
  type WorkoutCompletionSummary,
  type WorkoutExerciseProgress,
} from '@/lib/gymFlow';
import { getSessionMessage } from '@/lib/motivation';
import { colors, radii } from '@/lib/theme';
import type { ExerciseLibraryItem, WorkoutSession, WorkoutTemplate, WorkoutTemplateExercise } from '@/lib/types';

function formatSessionTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatTimedProgress(progress: WorkoutExerciseProgress | undefined, cardio: boolean) {
  if (!progress?.cardioComplete) return cardio ? 'Cardio · tap to start' : 'Timed hold · tap to start';
  const bits: string[] = [];
  if (progress.cardioDurationSeconds) bits.push(formatSessionTime(progress.cardioDurationSeconds));
  if (cardio && progress.cardioDistanceKm != null) bits.push(`${progress.cardioDistanceKm.toFixed(2)} km`);
  return bits.length ? bits.join(' · ') : 'Complete';
}

export default function TrainScreen() {
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [sessionExercises, setSessionExercises] = useState<WorkoutTemplateExercise[]>([]);
  const [nextTemplate, setNextTemplate] = useState<WorkoutTemplate | null>(null);
  const [progress, setProgress] = useState<WorkoutExerciseProgress[]>([]);
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [starting, setStarting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [summary, setSummary] = useState<WorkoutCompletionSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryNext, setSummaryNext] = useState<WorkoutTemplate | null>(null);

  const refresh = useCallback(async () => {
    const active = await getActiveWorkout();
    const selected = active?.templateId
      ? await getWorkoutTemplate(active.templateId)
      : await getRecommendedWorkoutTemplate();
    const [next, allExercises] = await Promise.all([
      selected ? getNextWorkoutTemplate(selected.id) : Promise.resolve(null),
      getExerciseLibrary(),
    ]);

    setActiveWorkout(active);
    setTemplate(selected);
    setNextTemplate(next);
    setLibrary(allExercises);

    if (active) {
      const [plan, nextProgress] = await Promise.all([
        getWorkoutExercisePlan(active.id, active.templateId),
        getWorkoutExerciseProgress(active.id),
      ]);
      setSessionExercises(plan);
      setProgress(nextProgress);
    } else {
      setSessionExercises(selected?.exercises ?? []);
      setProgress([]);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    refresh().catch(() => undefined);
  }, [refresh]));

  useEffect(() => {
    if (!activeWorkout) {
      setElapsedSeconds(0);
      return;
    }
    const update = () => {
      const started = Date.parse(activeWorkout.startedAt);
      setElapsedSeconds(Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  const progressMap = useMemo(
    () => new Map(progress.map((item) => [item.exerciseSlug, item])),
    [progress],
  );

  const completedCount = useMemo(() => sessionExercises.filter((exercise) => {
    const item = progressMap.get(exercise.slug);
    const mode = getExerciseTrackingMode(exercise);
    return isTimedTrackingMode(mode) ? Boolean(item?.cardioComplete) : (item?.completedSets ?? 0) >= exercise.targetSets;
  }).length, [progressMap, sessionExercises]);

  const filteredLibrary = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase();
    const existing = new Set(sessionExercises.map((exercise) => exercise.slug));
    return library
      .filter((exercise) => !existing.has(exercise.slug))
      .filter((exercise) => !query || `${exercise.name} ${exercise.muscle} ${exercise.equipment}`.toLowerCase().includes(query))
      .slice(0, 80);
  }, [library, pickerQuery, sessionExercises]);

  const openExercise = (exercise: WorkoutTemplateExercise) => {
    if (exercise.templateExerciseId && template) {
      router.push(`/exercise/${exercise.slug}?templateId=${template.id}`);
    } else {
      router.push(`/exercise/${exercise.slug}`);
    }
  };

  const startSession = async () => {
    if (starting || !template) return;
    setStarting(true);
    try {
      const workout = await startWorkout(template.name, template.id);
      setActiveWorkout(workout);
      const plan = await getWorkoutExercisePlan(workout.id, workout.templateId);
      setSessionExercises(plan);
      setProgress(await getWorkoutExerciseProgress(workout.id));
    } finally {
      setStarting(false);
    }
  };

  const finishSession = async () => {
    if (!activeWorkout) return;
    const workoutId = activeWorkout.id;
    const after = template ? await getNextWorkoutTemplate(template.id) : null;
    await finishWorkout(workoutId);
    const nextSummary = await getWorkoutCompletionSummary(workoutId);
    setSummary(nextSummary);
    setSummaryNext(after);
    setSummaryOpen(true);
    await refresh();
  };

  const moveExercise = async (exercise: WorkoutTemplateExercise, direction: 'up' | 'down') => {
    if (!activeWorkout) return;
    await moveWorkoutExercise(activeWorkout.id, exercise.id, direction);
    setSessionExercises(await getWorkoutExercisePlan(activeWorkout.id, activeWorkout.templateId));
  };

  const addExercise = async (exercise: ExerciseLibraryItem) => {
    if (!activeWorkout) return;
    await addExerciseToWorkout(activeWorkout.id, exercise.id);
    setPickerOpen(false);
    setPickerQuery('');
    setSessionExercises(await getWorkoutExercisePlan(activeWorkout.id, activeWorkout.templateId));
  };

  if (!template) {
    return (
      <Screen>
        <View style={styles.header}>
          <Eyebrow>Training</Eyebrow>
          <Title>Build your program.</Title>
          <Body style={{ marginTop: 8 }}>Create a workout rotation, then Forge will keep the next session ready whenever you train.</Body>
        </View>
        <PrimaryButton label="Open My Program" icon="tune" onPress={() => router.push('/programs')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Eyebrow>{activeWorkout ? `Session · ${formatSessionTime(elapsedSeconds)}` : 'Training'}</Eyebrow>
          <Title>{template.name}</Title>
          <Body style={{ marginTop: 8 }}>{template.subtitle} · {template.durationMinutes} min plan</Body>
        </View>
        <Pressable onPress={() => router.push('/programs')} style={styles.manageButton}>
          <MaterialCommunityIcons name="tune-variant" size={19} color={colors.accent} />
        </Pressable>
      </View>

      <Card style={[styles.hero, activeWorkout && styles.activeHero]}>
        {activeWorkout ? (
          <>
            <View style={styles.sessionTimerRow}>
              <View>
                <Text style={styles.heroLabel}>SESSION RUNNING</Text>
                <Text style={styles.sessionTimer}>{formatSessionTime(elapsedSeconds)}</Text>
              </View>
              <View style={styles.roundIcon}><MaterialCommunityIcons name="timer-outline" size={25} color={colors.accent} /></View>
            </View>
            <Text style={styles.heroCopy}>{completedCount} of {sessionExercises.length} exercises complete. Train in whatever order the gym allows.</Text>
            <Pressable onPress={finishSession} style={styles.finishButton}>
              <MaterialCommunityIcons name="flag-checkered" size={17} color={colors.text} />
              <Text style={styles.finishText}>Finish session</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>TODAY'S TARGET</Text>
                <Text style={styles.heroValue}>{template.workingSets} working sets</Text>
              </View>
              <View style={styles.roundIcon}><MaterialCommunityIcons name="dumbbell" size={24} color={colors.accent} /></View>
            </View>
            <Text style={styles.heroCopy}>Start the session when you arrive. Forge keeps the elapsed time from that timestamp even if you leave or close the app.</Text>
            <PrimaryButton label={starting ? 'Starting…' : 'Start session'} icon="play" onPress={startSession} />
          </>
        )}
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>{activeWorkout ? 'Active workout' : 'Workout'}</SectionTitle>
        {activeWorkout ? (
          <Pressable onPress={() => setPickerOpen(true)}><Text style={styles.editMeta}>+ ADD EXERCISE</Text></Pressable>
        ) : (
          <Pressable onPress={() => router.push({ pathname: '/workout-template/[id]', params: { id: String(template.id) } })}>
            <Text style={styles.editMeta}>EDIT</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.list}>
        {sessionExercises.map((exercise, index) => {
          const item = progressMap.get(exercise.slug);
          const mode = getExerciseTrackingMode(exercise);
          const timed = isTimedTrackingMode(mode);
          const cardio = mode === 'cardio';
          const bodyweightReps = mode === 'bodyweight-reps';
          const done = timed ? Boolean(item?.cardioComplete) : (item?.completedSets ?? 0) >= exercise.targetSets;
          return (
            <View key={`${exercise.id}:${index}`} style={[styles.exercise, done && styles.exerciseDone]}>
              <Pressable onPress={() => openExercise(exercise)} style={styles.exerciseOpen}>
                <View style={[styles.index, done && styles.indexDone]}>
                  {done ? <MaterialCommunityIcons name="check" size={17} color={colors.bg} /> : <Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text>}
                </View>
                <View style={styles.exerciseBody}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {timed
                      ? formatTimedProgress(item, cardio)
                      : bodyweightReps
                        ? `${item?.completedSets ?? 0}/${exercise.targetSets} sets · ${exercise.targetSets} × ${exercise.minReps}${exercise.minReps !== exercise.maxReps ? `–${exercise.maxReps}` : ''} reps · Bodyweight`
                        : `${item?.completedSets ?? 0}/${exercise.targetSets} sets · ${exercise.targetSets} × ${exercise.minReps}${exercise.minReps !== exercise.maxReps ? `–${exercise.maxReps}` : ''} · ${exercise.muscle}`}
                  </Text>
                  {!timed && !done ? (
                    <View style={styles.previousRow}>
                      <Text style={styles.previousLabel}>REST</Text>
                      <Text style={styles.previousValue}>{exercise.restSeconds}s</Text>
                    </View>
                  ) : null}
                </View>
                <MaterialCommunityIcons name="chevron-right" size={23} color={done ? colors.accent : colors.faint} />
              </Pressable>
              {activeWorkout ? (
                <View style={styles.reorder}>
                  <Pressable disabled={index === 0} onPress={() => moveExercise(exercise, 'up')} style={[styles.reorderButton, index === 0 && styles.reorderDisabled]}>
                    <MaterialCommunityIcons name="chevron-up" size={18} color={colors.muted} />
                  </Pressable>
                  <Pressable disabled={index === sessionExercises.length - 1} onPress={() => moveExercise(exercise, 'down')} style={[styles.reorderButton, index === sessionExercises.length - 1 && styles.reorderDisabled]}>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {nextTemplate && !activeWorkout ? (
        <>
          <View style={styles.sectionHead}><SectionTitle>Next up</SectionTitle><Text style={styles.meta}>Rotation</Text></View>
          <Card style={styles.nextCard}>
            <View style={{ flex: 1 }}><Text style={styles.nextTitle}>{nextTemplate.name}</Text><Body>{nextTemplate.subtitle}</Body></View>
            <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>{nextTemplate.durationMinutes} MIN</Text></View>
          </Card>
        </>
      ) : null}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <View><Eyebrow>Session only</Eyebrow><SectionTitle style={{ marginTop: 5 }}>Add an exercise</SectionTitle></View>
              <Pressable onPress={() => setPickerOpen(false)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={20} color={colors.muted} /></Pressable>
            </View>
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search treadmill, bike, pull-up…"
              placeholderTextColor={colors.faint}
              style={styles.searchInput}
            />
            <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
              {filteredLibrary.map((exercise) => (
                <Pressable key={exercise.id} onPress={() => addExercise(exercise)} style={styles.pickerRow}>
                  <View style={{ flex: 1 }}><Text style={styles.pickerTitle}>{exercise.name}</Text><Text style={styles.pickerMeta}>{exercise.muscle} · {exercise.equipment}</Text></View>
                  <MaterialCommunityIcons name="plus-circle" size={24} color={colors.accent} />
                </Pressable>
              ))}
              {!filteredLibrary.length ? <Body>No matching exercises to add.</Body> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={summaryOpen} transparent animationType="fade" onRequestClose={() => setSummaryOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryBadge}><MaterialCommunityIcons name="check-bold" size={28} color={colors.bg} /></View>
            <Eyebrow>Workout complete</Eyebrow>
            <Text style={styles.summaryTitle}>{summary ? formatSessionTime(summary.durationSeconds) : 'Done'}</Text>
            {summary ? (
              <View style={styles.summaryStats}>
                <View><Text style={styles.summaryStat}>{summary.completedExercises}</Text><Text style={styles.summaryLabel}>Exercises</Text></View>
                <View><Text style={styles.summaryStat}>{summary.completedSets}</Text><Text style={styles.summaryLabel}>Sets</Text></View>
                <View><Text style={styles.summaryStat}>{summary.personalBests}</Text><Text style={styles.summaryLabel}>PBs</Text></View>
              </View>
            ) : null}
            <Body style={{ textAlign: 'center' }}>{summary ? getSessionMessage(summary.completedSets + summary.durationSeconds) : 'Session saved.'}</Body>
            {summaryNext ? <Text style={styles.nextSessionText}>NEXT SESSION · {summaryNext.name.toUpperCase()}</Text> : null}
            <PrimaryButton label="Done" icon="check" onPress={() => setSummaryOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  header: { flex: 1, paddingTop: 10, marginBottom: 24 },
  manageButton: { marginTop: 8, height: 44, width: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.surface2, gap: 17 },
  activeHero: { borderWidth: 1, borderColor: '#344324' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sessionTimerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { color: colors.faint, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 5 },
  sessionTimer: { color: colors.accent, fontSize: 39, lineHeight: 44, fontWeight: '900', letterSpacing: -1.2, marginTop: 3 },
  roundIcon: { height: 50, width: 50, borderRadius: 25, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  finishButton: { minHeight: 48, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.surface3 },
  finishText: { color: colors.text, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: colors.faint, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  editMeta: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  list: { borderRadius: radii.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  exercise: { minHeight: 96, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'stretch' },
  exerciseDone: { backgroundColor: '#11170E' },
  exerciseOpen: { flex: 1, paddingVertical: 15, paddingLeft: 14, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  index: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  indexDone: { backgroundColor: colors.accent },
  indexText: { color: colors.faint, fontSize: 10, fontWeight: '900' },
  exerciseBody: { flex: 1 },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  exerciseMeta: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  previousRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  previousLabel: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  previousValue: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  reorder: { width: 40, justifyContent: 'center', gap: 2, paddingRight: 4 },
  reorderButton: { width: 34, height: 31, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface3 },
  reorderDisabled: { opacity: 0.2 },
  nextCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nextTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  nextBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surface3 },
  nextBadgeText: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  pickerCard: { maxHeight: '82%', backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: 36, borderTopWidth: 1, borderColor: colors.border },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  searchInput: { minHeight: 50, borderRadius: radii.md, backgroundColor: colors.surface3, color: colors.text, paddingHorizontal: 14, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  pickerList: { maxHeight: 430 },
  pickerRow: { minHeight: 66, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  pickerMeta: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  summaryCard: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 26, paddingBottom: 38, gap: 15, alignItems: 'center', borderTopWidth: 1, borderColor: colors.border },
  summaryBadge: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { color: colors.text, fontSize: 42, fontWeight: '900', letterSpacing: -1.3 },
  summaryStats: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', borderRadius: radii.md, backgroundColor: colors.surface2, paddingVertical: 16 },
  summaryStat: { color: colors.accent, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  summaryLabel: { color: colors.faint, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 3 },
  nextSessionText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
});