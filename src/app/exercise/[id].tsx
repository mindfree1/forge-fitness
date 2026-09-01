import { useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import TechniqueVideo from '@/components/TechniqueVideo';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import {
  getExerciseDetail,
  getPersonalBests,
  getPreviousExerciseSets,
  getWorkoutSets,
  getWorkoutTemplate,
  startWorkout,
} from '@/lib/db';
import { getExerciseTrackingMode, isTimedTrackingMode } from '@/lib/exerciseTracking';
import {
  deleteWorkoutSet,
  finishCardio,
  getCardioEntry,
  saveTimedWorkoutSet,
  startCardio,
  updateCardioDistance,
  type CardioEntry,
} from '@/lib/gymFlow';
import { colors, radii } from '@/lib/theme';
import type { PersonalBest, WorkoutTemplateExercise } from '@/lib/types';

type SetRow = { kg: string; reps: string; complete: boolean };
type PreviousRow = { weightKg: number | null; reps: number | null };

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatSessionTimer(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function previousLabel(row: PreviousRow | undefined, repsOnly: boolean) {
  if (!row || row.reps == null) return '—';
  if (repsOnly) return `${row.reps} reps`;
  if (row.weightKg == null) return '—';
  return `${formatNumber(row.weightKg)} × ${row.reps}`;
}

export default function ExerciseScreen() {
  const { id, templateId } = useLocalSearchParams<{ id: string; templateId?: string }>();
  const parsedTemplateId = useMemo(() => {
    const value = Number(templateId);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [templateId]);

  const [exercise, setExercise] = useState<WorkoutTemplateExercise | null>(null);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [previous, setPrevious] = useState<PreviousRow[]>([]);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [newPbMetrics, setNewPbMetrics] = useState<PersonalBest['metric'][]>([]);
  const [restRemaining, setRestRemaining] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [cardio, setCardio] = useState<CardioEntry | null>(null);
  const [cardioElapsed, setCardioElapsed] = useState(0);
  const [cardioDistance, setCardioDistance] = useState('');

  const trackingMode = exercise ? getExerciseTrackingMode(exercise) : 'weighted-reps';
  const isCardio = trackingMode === 'cardio';
  const isTimedBodyweight = trackingMode === 'timed-bodyweight';
  const isTimedActivity = isTimedTrackingMode(trackingMode);
  const isBodyweightReps = trackingMode === 'bodyweight-reps';
  const isUnilateral = exercise ? /one[ -]?arm|single[ -]?arm|one[ -]?side|single[ -]?side|unilateral/i.test(exercise.name) : false;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const detail = await getExerciseDetail(id, parsedTemplateId);
      if (!detail) return;
      const template = parsedTemplateId ? await getWorkoutTemplate(parsedTemplateId) : null;
      const workout = await startWorkout(template?.name ?? 'Workout', parsedTemplateId);
      const detailMode = getExerciseTrackingMode(detail);
      const timedExercise = isTimedTrackingMode(detailMode);
      const repsOnly = detailMode === 'bodyweight-reps';
      const [persistedSets, pbs, previousSets, cardioEntry] = await Promise.all([
        timedExercise ? Promise.resolve([]) : getWorkoutSets(workout.id, detail.slug),
        timedExercise ? Promise.resolve([]) : getPersonalBests(detail.slug),
        timedExercise ? Promise.resolve([]) : getPreviousExerciseSets(detail.slug, workout.id),
        timedExercise ? getCardioEntry(workout.id, detail.slug) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      setExercise(detail);
      setWorkoutId(workout.id);
      setSessionStartedAt(workout.startedAt);
      setPersonalBests(pbs);
      setPrevious(previousSets);
      setRestRemaining(detail.restSeconds);
      setCardio(cardioEntry);
      setCardioDistance(cardioEntry?.distanceKm == null ? '' : String(cardioEntry.distanceKm));

      if (!timedExercise) {
        if (persistedSets.length) {
          const rowCount = Math.max(detail.targetSets, persistedSets.length);
          setSets(Array.from({ length: rowCount }, (_, index) => {
            const saved = persistedSets[index];
            const prior = previousSets[index];
            return {
              kg: repsOnly ? '' : saved?.weightKg == null ? (prior?.weightKg == null ? '' : formatNumber(prior.weightKg)) : formatNumber(saved.weightKg),
              reps: saved?.reps == null ? (prior?.reps == null ? '' : String(prior.reps)) : String(saved.reps),
              complete: saved?.completed ?? false,
            };
          }));
        } else {
          setSets(Array.from({ length: detail.targetSets }, (_, index) => {
            const prior = previousSets[index];
            return {
              kg: repsOnly ? '' : prior?.weightKg == null ? '' : formatNumber(prior.weightKg),
              reps: prior?.reps == null ? '' : String(prior.reps),
              complete: false,
            };
          }));
        }
      }
    };
    load().catch(() => undefined);
    return () => { cancelled = true; };
  }, [id, parsedTemplateId]);

  useEffect(() => {
    if (!sessionStartedAt) return;
    const update = () => {
      const started = Date.parse(sessionStartedAt);
      setSessionElapsed(Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [sessionStartedAt]);

  useEffect(() => {
    if (!cardio?.startedAt || cardio.completedAt) {
      setCardioElapsed(cardio?.durationSeconds ?? 0);
      return;
    }
    const update = () => {
      const started = Date.parse(cardio.startedAt!);
      setCardioElapsed(Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [cardio]);

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

  useEffect(() => {
    if (!exerciseDone) return;
    const timeout = setTimeout(() => router.back(), 1250);
    return () => clearTimeout(timeout);
  }, [exerciseDone]);

  const refreshPbs = async () => {
    if (!exercise) return;
    setPersonalBests(await getPersonalBests(exercise.slug));
  };

  const persistSet = async (index: number, row: SetRow) => {
    if (!workoutId || !exercise) return [];
    const weightKg = isBodyweightReps || row.kg.trim() === '' ? null : Number(row.kg);
    const reps = row.reps.trim() === '' ? null : Number(row.reps);
    if ((weightKg !== null && !Number.isFinite(weightKg)) || (reps !== null && !Number.isFinite(reps))) return [];
    return saveTimedWorkoutSet({
      workoutId,
      exerciseSlug: exercise.slug,
      setNumber: index + 1,
      weightKg,
      reps,
      completed: row.complete,
    }, { repsOnly: isBodyweightReps });
  };

  const updateSet = (index: number, field: 'kg' | 'reps', value: string) => {
    setSets((current) => {
      const nextRows = current.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set);
      const next = nextRows[index];
      const ready = isBodyweightReps ? Boolean(next.reps.trim()) : Boolean(next.kg.trim() && next.reps.trim());
      if (ready) persistSet(index, next).catch(() => undefined);
      return nextRows;
    });
  };

  const toggleComplete = async (index: number) => {
    if (!exercise) return;
    const current = sets[index];
    const hasRequiredData = isBodyweightReps ? Boolean(current.reps.trim()) : Boolean(current.kg.trim() && current.reps.trim());
    if (!current.complete && !hasRequiredData) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }

    const next = { ...current, complete: !current.complete };
    Haptics.selectionAsync().catch(() => undefined);
    const nextRows = sets.map((set, setIndex) => setIndex === index ? next : set);
    setSets(nextRows);

    const achieved = await persistSet(index, next);
    if (next.complete) {
      setRestRemaining(exercise.restSeconds);
      setRestRunning(true);
    }
    if (achieved.length) {
      setNewPbMetrics(achieved);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await refreshPbs();
    }

    const prescribed = nextRows.slice(0, exercise.targetSets);
    if (next.complete && prescribed.length >= exercise.targetSets && prescribed.every((row) => row.complete)) {
      setRestRunning(false);
      setExerciseDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  };

  const addSet = () => setSets((current) => [...current, { kg: '', reps: '', complete: false }]);

  const removeLastExtraSet = async (index: number) => {
    if (!workoutId || !exercise || index !== sets.length - 1 || index < exercise.targetSets || sets[index].complete) return;
    await deleteWorkoutSet(workoutId, exercise.slug, index + 1);
    setSets((current) => current.slice(0, -1));
  };

  const beginCardio = async () => {
    if (!workoutId || !exercise) return;
    const next = await startCardio(workoutId, exercise.slug);
    setCardio(next);
    Haptics.selectionAsync().catch(() => undefined);
  };

  const stopCardio = async () => {
    if (!workoutId || !exercise) return;
    const next = await finishCardio(workoutId, exercise.slug);
    setCardio(next);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };

  const saveCardioDistance = async () => {
    if (!workoutId || !exercise || !cardio) return;
    const value = cardioDistance.trim() ? Number(cardioDistance) : null;
    await updateCardioDistance(workoutId, exercise.slug, value != null && Number.isFinite(value) ? value : null);
    setCardio(await getCardioEntry(workoutId, exercise.slug));
  };

  if (!exercise) {
    return <Screen><View style={styles.nav}><Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable></View><Title>Loading exercise…</Title></Screen>;
  }

  const weightPb = personalBests.find((pb) => pb.metric === 'weight');
  const repsPb = personalBests.find((pb) => pb.metric === 'reps');
  const e1rmPb = personalBests.find((pb) => pb.metric === 'e1rm');
  const loadSuffix = isUnilateral ? ' kg / arm' : ' kg';
  const loadHeader = isUnilateral ? 'KG/ARM' : 'KG';
  const pbHeadline = isBodyweightReps
    ? repsPb ? `${formatNumber(repsPb.value)} reps best set` : 'Set your baseline'
    : weightPb ? `${formatNumber(weightPb.value)}${loadSuffix} max set` : 'Set your baseline';
  const pbSubline = isBodyweightReps
    ? repsPb ? 'Best completed bodyweight set' : 'Complete a working set to start rep tracking'
    : e1rmPb ? `Estimated 1RM ${formatNumber(e1rmPb.value)}${loadSuffix}` : 'Complete a working set to start PB tracking';
  const targetLabel = `${exercise.targetSets} × ${exercise.minReps}${exercise.minReps !== exercise.maxReps ? `–${exercise.maxReps}` : ''}`;
  const isFirstSetEntry = isBodyweightReps
    ? previous.every((row) => row.reps == null) && sets.every((row) => !row.reps.trim())
    : previous.every((row) => row.weightKg == null && row.reps == null) && sets.every((row) => !row.kg.trim() && !row.reps.trim());

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable>
        <Text style={styles.navTitle}>SESSION {formatSessionTimer(sessionElapsed)}</Text>
        <Pressable
          onPress={() => {
            if (parsedTemplateId) router.push({ pathname: '/workout-template/[id]', params: { id: String(parsedTemplateId) } });
          }}
          style={styles.navButton}
        >
          {parsedTemplateId ? <MaterialCommunityIcons name="playlist-edit" size={19} color={colors.muted} /> : null}
        </Pressable>
      </View>

      <Eyebrow>{exercise.muscle}</Eyebrow>
      <Title style={{ marginTop: 6 }}>{exercise.name}</Title>
      <Body style={{ marginTop: 9 }}>
        {isCardio
          ? `${exercise.equipment} · timed cardio`
          : isTimedBodyweight
            ? `${exercise.equipment} · timed hold`
            : isBodyweightReps
              ? `${exercise.equipment} · Target ${targetLabel} reps`
              : `${exercise.equipment} · Target ${targetLabel}`}
      </Body>
      {isUnilateral && trackingMode === 'weighted-reps' ? <Text style={styles.loadNote}>Log the displayed load for each working arm.</Text> : null}

      {exerciseDone ? (
        <View style={styles.exerciseCompleteBanner}>
          <MaterialCommunityIcons name="check-circle" size={22} color={colors.bg} />
          <View style={{ flex: 1 }}><Text style={styles.exerciseCompleteTitle}>Exercise complete</Text><Text style={styles.exerciseCompleteCopy}>All prescribed sets done · returning to your workout.</Text></View>
        </View>
      ) : null}

      {!isTimedActivity && newPbMetrics.length > 0 ? (
        <View style={styles.pbCelebration}>
          <MaterialCommunityIcons name="trophy" size={18} color={colors.bg} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pbCelebrationTitle}>New personal best</Text>
            <Text style={styles.pbCelebrationCopy}>{newPbMetrics.map((metric) => metric.toUpperCase()).join(' · ')}</Text>
          </View>
          <Pressable onPress={() => setNewPbMetrics([])}><MaterialCommunityIcons name="close" size={18} color={colors.bg} /></Pressable>
        </View>
      ) : null}

      {isTimedActivity ? (
        <>
          <Card style={styles.cardioCard}>
            <View style={styles.cardioTop}>
              <View>
                <Text style={styles.micro}>
                  {cardio?.completedAt
                    ? isCardio ? 'CARDIO COMPLETE' : 'HOLD COMPLETE'
                    : cardio?.startedAt
                      ? isCardio ? 'CARDIO RUNNING' : 'HOLD RUNNING'
                      : isCardio ? 'CARDIO WARM-UP' : 'TIMED HOLD'}
                </Text>
                <Text style={styles.cardioTimer}>{formatSessionTimer(cardioElapsed)}</Text>
              </View>
              <View style={[styles.pbBadge, cardio?.startedAt && !cardio.completedAt && styles.cardioLive]}>
                <MaterialCommunityIcons
                  name={isCardio ? 'heart-pulse' : 'timer-outline'}
                  size={23}
                  color={cardio?.startedAt && !cardio.completedAt ? colors.bg : colors.accent}
                />
              </View>
            </View>
            <Body>
              {cardio?.completedAt
                ? isCardio
                  ? 'Timer saved. Add the machine distance if you want it in your session record.'
                  : 'Timed hold saved to this workout.'
                : 'One tap starts the timer. It keeps the original timestamp if Forge goes to the background.'}
            </Body>
            {!cardio?.startedAt ? (
              <PrimaryButton label={isCardio ? 'Start cardio' : 'Start hold'} icon="play" onPress={beginCardio} />
            ) : !cardio.completedAt ? (
              <PrimaryButton label={isCardio ? 'Stop cardio' : 'Stop hold'} icon="stop" onPress={stopCardio} />
            ) : isCardio ? (
              <PrimaryButton label="Start another effort" icon="play" onPress={beginCardio} />
            ) : null}
          </Card>

          {isCardio && cardio?.startedAt ? (
            <Card style={styles.distanceCard}>
              <View style={{ flex: 1 }}><Text style={styles.micro}>DISTANCE</Text><Text style={styles.distanceHelp}>Enter what the machine displays</Text></View>
              <TextInput
                value={cardioDistance}
                onChangeText={setCardioDistance}
                onEndEditing={() => saveCardioDistance().catch(() => undefined)}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.faint}
                style={styles.distanceInput}
              />
              <Text style={styles.distanceUnit}>km</Text>
            </Card>
          ) : null}

          {cardio?.completedAt ? <PrimaryButton label="Done — back to workout" icon="check" onPress={() => router.back()} /> : null}
        </>
      ) : (
        <>
          <Card style={styles.performanceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.micro}>{isBodyweightReps ? 'CURRENT REP BEST' : 'CURRENT PB'}</Text>
              <Text style={styles.big}>{pbHeadline}</Text>
              <Text style={styles.pbSubline}>{pbSubline}</Text>
            </View>
            <Pressable onPress={() => router.push('/pb-history')} style={styles.pbBadge}><MaterialCommunityIcons name="trophy" size={21} color={colors.bg} /></Pressable>
          </Card>

          <View style={styles.sectionHead}>
            <SectionTitle>Working sets</SectionTitle>
            <View style={styles.timerWrap}>
              <Pressable onPress={() => restRemaining > 0 && setRestRunning((current) => !current)} style={styles.timerButton}>
                <MaterialCommunityIcons name={restRunning ? 'pause' : 'play'} size={13} color={colors.accent} />
                <Text style={styles.rest}>REST {formatTimer(restRemaining)}</Text>
              </Pressable>
              <Pressable onPress={() => { setRestRemaining(exercise.restSeconds); setRestRunning(false); }} style={styles.resetButton}>
                <MaterialCommunityIcons name="refresh" size={14} color={colors.faint} />
              </Pressable>
            </View>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.columnHead, { width: 42 }]}>SET</Text>
            <Text style={[styles.columnHead, { flex: 1 }]}>PREVIOUS</Text>
            {!isBodyweightReps ? <Text style={[styles.columnHead, { width: 78, textAlign: 'center' }]}>{loadHeader}</Text> : null}
            <Text style={[styles.columnHead, { width: isBodyweightReps ? 104 : 68, textAlign: 'center' }]}>REPS</Text>
            <View style={{ width: 42 }} />
          </View>
          {isFirstSetEntry ? (
            <Text style={styles.setHint}>
              {isBodyweightReps
                ? 'Tap the green + under REPS to set your target, then tick the set when you finish it.'
                : `Tap the green + under ${loadHeader} and REPS to set your target, then tick the set when you finish it.`}
            </Text>
          ) : null}
          <View style={styles.setList}>
            {sets.map((set, index) => {
              const canDelete = index === sets.length - 1 && index >= exercise.targetSets && !set.complete;
              return (
                <View key={index} style={[styles.setRow, set.complete && styles.setComplete]}>
                  <Text style={styles.setNumber}>{index + 1}</Text>
                  <Text style={styles.previous}>{previousLabel(previous[index], isBodyweightReps)}</Text>
                  {!isBodyweightReps ? (
                    <TextInput
                      accessibilityLabel={`Weight in kilograms for set ${index + 1}`}
                      value={set.kg}
                      onChangeText={(value) => updateSet(index, 'kg', value)}
                      onEndEditing={() => persistSet(index, sets[index]).catch(() => undefined)}
                      keyboardType="decimal-pad"
                      placeholder="+"
                      placeholderTextColor={colors.accent}
                      style={styles.setInput}
                      selectTextOnFocus={Boolean(set.kg)}
                    />
                  ) : null}
                  <TextInput
                    accessibilityLabel={`Repetitions for set ${index + 1}`}
                    value={set.reps}
                    onChangeText={(value) => updateSet(index, 'reps', value)}
                    onEndEditing={() => persistSet(index, sets[index]).catch(() => undefined)}
                    keyboardType="number-pad"
                    placeholder="+"
                    placeholderTextColor={colors.accent}
                    style={[styles.repInput, isBodyweightReps && styles.repOnlyInput]}
                    selectTextOnFocus={Boolean(set.reps)}
                  />
                  {canDelete ? (
                    <Pressable onPress={() => removeLastExtraSet(index)} style={styles.deleteSet} accessibilityLabel={`Delete set ${index + 1}`}>
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => toggleComplete(index)} style={[styles.check, set.complete && styles.checkDone]}>
                      {set.complete && <MaterialCommunityIcons name="check" size={17} color={colors.bg} />}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
          <Pressable onPress={addSet} style={styles.addSet}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.accent} /><Text style={styles.addSetText}>Add set</Text>
          </Pressable>
        </>
      )}

      <View style={styles.sectionHead}><SectionTitle>Technique</SectionTitle><Text style={styles.rest}>{exercise.videoUrl ? 'VIDEO READY' : 'VIDEO OPTIONAL'}</Text></View>
      <Card style={styles.techniqueCard}>
        {exercise.videoUrl ? (
          <>
            <View style={styles.videoFrame}><TechniqueVideo url={exercise.videoUrl} /></View>
            <View><Text style={styles.techniqueTitle}>Watch technique video</Text><Body>{exercise.techniqueNotes ?? 'Use the video as a quick form check, then keep your reps controlled and consistent.'}</Body></View>
          </>
        ) : (
          <View style={styles.techniqueRow}>
            <View style={styles.videoPlaceholder}><View style={styles.playMuted}><MaterialCommunityIcons name="video-off-outline" size={24} color={colors.bg} /></View></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.techniqueTitle}>Keep the rep clean</Text>
              <Body>{exercise.techniqueNotes ?? (isCardio
                ? 'Use a controlled sustainable pace for the warm-up and stop if anything feels wrong.'
                : isTimedBodyweight
                  ? 'Brace steadily and end the hold when you can no longer maintain the intended position.'
                  : 'Use a controlled range of motion and stop the set when technique starts to break down.')}</Body>
            </View>
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, marginBottom: 25 },
  navButton: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  loadNote: { color: colors.accent, fontSize: 10, fontWeight: '800', marginTop: 6 },
  exerciseCompleteBanner: { marginTop: 18, borderRadius: radii.md, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exerciseCompleteTitle: { color: colors.bg, fontSize: 12, fontWeight: '900' },
  exerciseCompleteCopy: { color: colors.bg, opacity: 0.7, fontSize: 9, fontWeight: '800', marginTop: 2 },
  pbCelebration: { marginTop: 20, borderRadius: radii.md, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  pbCelebrationTitle: { color: colors.bg, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  pbCelebrationCopy: { color: colors.bg, opacity: 0.72, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 2 },
  performanceCard: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  micro: { color: colors.faint, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  big: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  pbSubline: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  pbBadge: { height: 46, width: 46, borderRadius: 23, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  cardioLive: { backgroundColor: colors.accent },
  cardioCard: { marginTop: 24, gap: 16 },
  cardioTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardioTimer: { color: colors.accent, fontSize: 48, lineHeight: 54, fontWeight: '900', letterSpacing: -1.5, marginTop: 3 },
  distanceCard: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  distanceHelp: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  distanceInput: { width: 88, minHeight: 50, borderRadius: radii.md, backgroundColor: colors.surface3, color: colors.text, textAlign: 'center', fontSize: 19, fontWeight: '900' },
  distanceUnit: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerButton: { minHeight: 30, paddingHorizontal: 8, borderRadius: radii.pill, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 5 },
  resetButton: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rest: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 7 },
  columnHead: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  setHint: { color: colors.muted, fontSize: 10, fontWeight: '700', lineHeight: 15, marginBottom: 9, paddingHorizontal: 10 },
  setList: { gap: 7 },
  setRow: { minHeight: 64, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 },
  setComplete: { borderColor: '#344324', backgroundColor: '#141A10' },
  setNumber: { width: 38, color: colors.muted, fontSize: 12, fontWeight: '900' },
  previous: { flex: 1, color: colors.faint, fontSize: 11, fontWeight: '700' },
  setInput: { width: 78, minHeight: 48, borderRadius: 12, backgroundColor: colors.surface3, color: colors.text, textAlign: 'center', fontSize: 16, fontWeight: '900', paddingVertical: 10, marginHorizontal: 2 },
  repInput: { width: 68, minHeight: 48, borderRadius: 12, backgroundColor: colors.surface3, color: colors.text, textAlign: 'center', fontSize: 16, fontWeight: '900', paddingVertical: 10, marginHorizontal: 2 },
  repOnlyInput: { width: 104 },
  check: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  deleteSet: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2A1715', alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
  addSet: { marginTop: 10, height: 48, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  addSetText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  techniqueCard: { gap: 14 },
  techniqueRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  videoFrame: { height: 210, width: '100%', borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surface3 },
  videoPlaceholder: { width: 90, height: 78, borderRadius: radii.md, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  playMuted: { height: 38, width: 38, borderRadius: 19, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  techniqueTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 5 },
});