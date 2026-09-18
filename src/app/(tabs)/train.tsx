import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import {
  deleteWorkout,
  finishWorkout,
  getActiveProgram,
  getActiveWorkout,
  getExerciseLibrary,
  getNextWorkoutTemplate,
  getRecommendedWorkoutTemplate,
  getWorkoutTemplate,
  getWorkoutTemplates,
  startWorkout,
  updateWorkoutTimes,
} from '@/lib/db';
import { getExerciseTrackingMode, isTimedTrackingMode } from '@/lib/exerciseTracking';
import {
  addExerciseToWorkout,
  getWorkoutActivityBounds,
  getWorkoutCompletionSummary,
  getWorkoutExercisePlan,
  getWorkoutExerciseProgress,
  removeExerciseFromWorkout,
  setWorkoutExerciseOrder,
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

function DragHandle({
  index,
  count,
  onDrop,
}: {
  index: number;
  count: number;
  onDrop: (from: number, to: number) => void;
}) {
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
    onPanResponderRelease: (_, gesture) => {
      const offset = Math.round(gesture.dy / 96);
      const target = Math.max(0, Math.min(count - 1, index + offset));
      if (target !== index) onDrop(index, target);
    },
  }), [count, index, onDrop]);

  return (
    <View {...responder.panHandlers} style={styles.dragHandle} accessibilityLabel="Drag to reorder exercise">
      <MaterialCommunityIcons name="drag-vertical" size={24} color={colors.muted} />
    </View>
  );
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
  const [programTemplates, setProgramTemplates] = useState<WorkoutTemplate[]>([]);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [stalePromptOpen, setStalePromptOpen] = useState(false);
  const [stalePromptedId, setStalePromptedId] = useState<number | null>(null);
  const [finishPromptOpen, setFinishPromptOpen] = useState(false);
  const [finishPromptDismissedId, setFinishPromptDismissedId] = useState<number | null>(null);
  const [customDraft, setCustomDraft] = useState(false);

  const refresh = useCallback(async () => {
    const active = await getActiveWorkout();
    const program = await getActiveProgram();
    const templates = program ? await getWorkoutTemplates(program.id) : [];
    const recommended = active
      ? (active.templateId ? await getWorkoutTemplate(active.templateId) : null)
      : await getRecommendedWorkoutTemplate();
    const [next, allExercises] = await Promise.all([
      recommended ? getNextWorkoutTemplate(recommended.id) : Promise.resolve(null),
      getExerciseLibrary(),
    ]);

    setActiveWorkout(active);
    setTemplate(recommended);
    if (active || recommended) setCustomDraft(false);
    setNextTemplate(next);
    setLibrary(allExercises);
    setProgramTemplates(templates);

    if (active) {
      const [plan, nextProgress] = await Promise.all([
        getWorkoutExercisePlan(active.id, active.templateId),
        getWorkoutExerciseProgress(active.id),
      ]);
      setSessionExercises(plan);
      setProgress(nextProgress);
    } else {
      setSessionExercises(recommended?.exercises ?? []);
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

  useEffect(() => {
    if (!activeWorkout) {
      setStalePromptOpen(false);
      return;
    }
    const ageSeconds = Math.max(0, (Date.now() - Date.parse(activeWorkout.startedAt)) / 1000);
    if (ageSeconds > 4 * 3600 && stalePromptedId !== activeWorkout.id) {
      setStalePromptOpen(true);
    }
  }, [activeWorkout, stalePromptedId]);

  const progressMap = useMemo(
    () => new Map(progress.map((item) => [item.exerciseSlug, item])),
    [progress],
  );

  const completedCount = useMemo(() => sessionExercises.filter((exercise) => {
    const item = progressMap.get(exercise.slug);
    const mode = getExerciseTrackingMode(exercise);
    return isTimedTrackingMode(mode) ? Boolean(item?.cardioComplete) : (item?.completedSets ?? 0) >= exercise.targetSets;
  }).length, [progressMap, sessionExercises]);

  useEffect(() => {
    if (!activeWorkout || !sessionExercises.length || elapsedSeconds > 4 * 3600) return;
    if (completedCount === sessionExercises.length && finishPromptDismissedId !== activeWorkout.id) {
      setFinishPromptOpen(true);
    }
  }, [activeWorkout, completedCount, finishPromptDismissedId, sessionExercises.length]);

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
    if (starting || (!template && !customDraft)) return;
    setStarting(true);
    try {
      const workout = await startWorkout(template?.name ?? 'Quick session', template?.id ?? null);
      if (customDraft) {
        for (const exercise of sessionExercises) {
          await addExerciseToWorkout(workout.id, exercise.id);
        }
      }
      setActiveWorkout(workout);
      const plan = await getWorkoutExercisePlan(workout.id, workout.templateId);
      setSessionExercises(plan);
      setProgress(await getWorkoutExerciseProgress(workout.id));
      setCustomDraft(false);
    } finally {
      setStarting(false);
    }
  };

  const beginQuickDraft = () => {
    setTemplate(null);
    setNextTemplate(null);
    setSessionExercises([]);
    setProgress([]);
    setCustomDraft(true);
    setSessionPickerOpen(false);
    setPickerOpen(true);
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
    setFinishPromptOpen(false);
    await refresh();
  };

  const confirmDeleteSession = () => {
    if (!activeWorkout) return;
    Alert.alert(
      'Delete this session?',
      'The workout and its sets will be removed. Forge will rebuild PB history from the training that remains.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete session',
          style: 'destructive',
          onPress: () => {
            deleteWorkout(activeWorkout.id)
              .then(() => {
                setStalePromptOpen(false);
                setFinishPromptOpen(false);
                return refresh();
              })
              .catch(() => undefined);
          },
        },
      ],
    );
  };

  const recoverStaleSession = async () => {
    if (!activeWorkout) return;
    const bounds = await getWorkoutActivityBounds(activeWorkout.id);
    if (!bounds.firstActivityAt || !bounds.lastActivityAt) {
      Alert.alert(
        'No reliable activity timestamps',
        'Forge cannot safely guess when this old session actually happened. Continue it if it is real, or delete it if it was left open by mistake.',
      );
      return;
    }
    await updateWorkoutTimes(activeWorkout.id, bounds.firstActivityAt, bounds.lastActivityAt);
    setStalePromptOpen(false);
    setStalePromptedId(activeWorkout.id);
    await refresh();
  };

  const reorderExercise = useCallback(async (from: number, to: number) => {
    if (from === to) return;
    const next = [...sessionExercises];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSessionExercises(next);
    if (activeWorkout) {
      await setWorkoutExerciseOrder(activeWorkout.id, next.map((exercise) => exercise.id));
    }
  }, [activeWorkout, sessionExercises]);

  const removeDraftExercise = (exercise: WorkoutTemplateExercise) => {
    setSessionExercises((current) => current.filter((item) => item.id !== exercise.id));
  };

  const confirmRemoveExercise = (exercise: WorkoutTemplateExercise) => {
    if (!activeWorkout) return;
    Alert.alert(
      'Remove from this session?',
      `${exercise.name} will be removed only from today’s active workout. Your permanent program stays unchanged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove exercise',
          style: 'destructive',
          onPress: () => {
            removeExerciseFromWorkout(activeWorkout.id, exercise.id)
              .then(async () => {
                setSessionExercises(await getWorkoutExercisePlan(activeWorkout.id, activeWorkout.templateId));
                setProgress(await getWorkoutExerciseProgress(activeWorkout.id));
              })
              .catch(() => undefined);
          },
        },
      ],
    );
  };

  const addExercise = async (exercise: ExerciseLibraryItem) => {
    if (!activeWorkout) {
      if (!customDraft) return;
      const draftExercise: WorkoutTemplateExercise = {
        ...exercise,
        templateExerciseId: 0,
        position: sessionExercises.length,
        targetSets: 3,
        minReps: 8,
        maxReps: 12,
        restSeconds: 90,
      };
      setSessionExercises((current) => [...current, draftExercise]);
      setPickerOpen(false);
      setPickerQuery('');
      return;
    }
    await addExerciseToWorkout(activeWorkout.id, exercise.id);
    setPickerOpen(false);
    setPickerQuery('');
    setSessionExercises(await getWorkoutExercisePlan(activeWorkout.id, activeWorkout.templateId));
  };


  if (!template && !activeWorkout && !customDraft) {
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
          <Title>{template?.name ?? activeWorkout?.name ?? 'Quick session'}</Title>
          <Body style={{ marginTop: 8 }}>{template ? `${template.subtitle} · ${template.durationMinutes} min plan` : 'Session-only workout · build what you need today'}</Body>
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
                <Text style={styles.heroLabel}>{elapsedSeconds > 4 * 3600 ? 'UNFINISHED SESSION' : 'SESSION RUNNING'}</Text>
                <Text style={styles.sessionTimer}>{elapsedSeconds > 4 * 3600 ? 'Needs review' : formatSessionTime(elapsedSeconds)}</Text>
              </View>
              <View style={styles.roundIcon}><MaterialCommunityIcons name="timer-outline" size={25} color={colors.accent} /></View>
            </View>
            <Text style={styles.heroCopy}>{completedCount} of {sessionExercises.length} exercises complete. Drag to reorder; long-press an exercise to remove it from this session.</Text>
            <Pressable onPress={finishSession} style={styles.finishButton}>
              <MaterialCommunityIcons name="flag-checkered" size={17} color={colors.text} />
              <Text style={styles.finishText}>Finish session</Text>
            </Pressable>
            <View style={styles.sessionActionRow}>
              <Pressable onPress={() => router.push('/session-history')} style={styles.sessionAction}>
                <MaterialCommunityIcons name="history" size={16} color={colors.muted} />
                <Text style={styles.sessionActionText}>History</Text>
              </Pressable>
              <Pressable onPress={confirmDeleteSession} style={styles.sessionAction}>
                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.danger} />
                <Text style={[styles.sessionActionText, { color: colors.danger }]}>Delete session</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>TODAY'S TARGET</Text>
                <Text style={styles.heroValue}>{template?.workingSets ?? sessionExercises.reduce((sum, exercise) => sum + exercise.targetSets, 0)} working sets</Text>
              </View>
              <View style={styles.roundIcon}><MaterialCommunityIcons name="dumbbell" size={24} color={colors.accent} /></View>
            </View>
            <Text style={styles.heroCopy}>Forge suggests the next rotation, but you choose what makes sense today before the timer starts.</Text>
            <Pressable onPress={() => setSessionPickerOpen(true)} style={styles.sessionChoice}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>TODAY'S SESSION</Text>
                <Text style={styles.sessionChoiceName}>{customDraft ? 'Quick session / Custom today' : template?.name ?? 'Choose session'}</Text>
              </View>
              <Text style={styles.changeText}>CHANGE</Text>
            </Pressable>
            <PrimaryButton label={starting ? 'Starting…' : customDraft && !sessionExercises.length ? 'Add an exercise first' : 'Start session'} icon="play" onPress={customDraft && !sessionExercises.length ? () => setPickerOpen(true) : startSession} />
          </>
        )}
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>{activeWorkout ? 'Active workout' : 'Workout'}</SectionTitle>
        {activeWorkout || customDraft ? (
          <Pressable onPress={() => setPickerOpen(true)}><Text style={styles.editMeta}>+ ADD EXERCISE</Text></Pressable>
        ) : (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => router.push('/session-history')}><Text style={styles.editMeta}>HISTORY</Text></Pressable>
            {template ? (
              <Pressable onPress={() => router.push({ pathname: '/workout-template/[id]', params: { id: String(template.id) } })}>
                <Text style={styles.editMeta}>EDIT</Text>
              </Pressable>
            ) : null}
          </View>
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
              <Pressable
                onPress={activeWorkout ? () => openExercise(exercise) : customDraft ? undefined : () => openExercise(exercise)}
                onLongPress={activeWorkout ? () => confirmRemoveExercise(exercise) : customDraft ? () => removeDraftExercise(exercise) : undefined}
                delayLongPress={500}
                style={styles.exerciseOpen}
                accessibilityHint={activeWorkout || customDraft ? 'Long press to remove this exercise from the current session' : undefined}
              >
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
              {activeWorkout || customDraft ? (
                <DragHandle index={index} count={sessionExercises.length} onDrop={reorderExercise} />
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

      <Modal visible={sessionPickerOpen} transparent animationType="fade" onRequestClose={() => setSessionPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <View><Eyebrow>Train today</Eyebrow><SectionTitle style={{ marginTop: 5 }}>Choose your session</SectionTitle></View>
              <Pressable onPress={() => setSessionPickerOpen(false)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={20} color={colors.muted} /></Pressable>
            </View>
            <Body style={{ marginBottom: 10 }}>Rotation is a recommendation, not a rule. Pick another session without changing your permanent program.</Body>
            <ScrollView style={styles.pickerList}>
              {programTemplates.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => { setTemplate(option); setNextTemplate(null); setSessionExercises(option.exercises); setCustomDraft(false); setSessionPickerOpen(false); }}
                  style={styles.pickerRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerTitle}>{option.name}</Text>
                    <Text style={styles.pickerMeta}>{option.subtitle} · {option.exerciseCount} exercises</Text>
                  </View>
                  {template?.id === option.id ? <MaterialCommunityIcons name="check-circle" size={23} color={colors.accent} /> : <MaterialCommunityIcons name="chevron-right" size={22} color={colors.faint} />}
                </Pressable>
              ))}
              <Pressable onPress={beginQuickDraft} style={styles.quickSessionRow}>
                <View style={styles.quickSessionIcon}><MaterialCommunityIcons name="playlist-plus" size={21} color={colors.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerTitle}>Quick session / Custom today</Text>
                  <Text style={styles.pickerMeta}>Start empty, then add only the exercises you want today.</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.accent} />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      <Modal visible={stalePromptOpen} transparent animationType="fade" onRequestClose={() => { setStalePromptOpen(false); if (activeWorkout) setStalePromptedId(activeWorkout.id); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.summaryCard}>
            <View style={styles.warningBadge}><MaterialCommunityIcons name="timer-alert-outline" size={29} color={colors.accent} /></View>
            <Eyebrow>Unfinished session found</Eyebrow>
            <Text style={styles.controlTitle}>{activeWorkout?.name ?? 'Workout'}</Text>
            <Body style={{ textAlign: 'center' }}>This session has been running far longer than a normal workout. Forge will not treat the elapsed timer as real until you choose what happened.</Body>
            <PrimaryButton label="Fix using logged activity" icon="auto-fix" onPress={() => recoverStaleSession().catch(() => undefined)} />
            <Pressable onPress={() => { if (activeWorkout) setStalePromptedId(activeWorkout.id); setStalePromptOpen(false); }} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Continue this session</Text></Pressable>
            <Pressable onPress={confirmDeleteSession} style={styles.secondaryAction}><Text style={[styles.secondaryActionText, { color: colors.danger }]}>Delete session</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={finishPromptOpen} transparent animationType="fade" onRequestClose={() => { if (activeWorkout) setFinishPromptDismissedId(activeWorkout.id); setFinishPromptOpen(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryBadge}><MaterialCommunityIcons name="check-bold" size={28} color={colors.bg} /></View>
            <Eyebrow>Planned workout complete</Eyebrow>
            <Text style={styles.controlTitle}>Finished for today?</Text>
            <Body style={{ textAlign: 'center' }}>Every exercise in this session is complete. Finish now, or keep training if you want to add cardio or another exercise.</Body>
            <PrimaryButton label="Finish session" icon="flag-checkered" onPress={finishSession} />
            <Pressable onPress={() => { if (activeWorkout) setFinishPromptDismissedId(activeWorkout.id); setFinishPromptOpen(false); }} style={styles.secondaryAction}><Text style={styles.secondaryActionText}>Keep training</Text></Pressable>
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
  sessionActionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  sessionAction: { flex: 1, minHeight: 38, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sessionActionText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  sessionChoice: { minHeight: 60, borderRadius: radii.md, backgroundColor: colors.surface3, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionChoiceName: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  changeText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
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
  dragHandle: { width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
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
  quickSessionRow: { minHeight: 82, marginTop: 10, borderRadius: radii.md, borderWidth: 1, borderColor: '#344324', backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  quickSessionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface3 },
  summaryCard: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 26, paddingBottom: 38, gap: 15, alignItems: 'center', borderTopWidth: 1, borderColor: colors.border },
  summaryBadge: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  warningBadge: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  controlTitle: { color: colors.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center' },
  secondaryAction: { minHeight: 44, width: '100%', alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: colors.muted, fontSize: 12, fontWeight: '900' },
  summaryTitle: { color: colors.text, fontSize: 42, fontWeight: '900', letterSpacing: -1.3 },
  summaryStats: { width: '100%', flexDirection: 'row', justifyContent: 'space-around', borderRadius: radii.md, backgroundColor: colors.surface2, paddingVertical: 16 },
  summaryStat: { color: colors.accent, fontSize: 21, fontWeight: '900', textAlign: 'center' },
  summaryLabel: { color: colors.faint, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 3 },
  nextSessionText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
});