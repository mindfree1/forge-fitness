import { useCallback, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import {
  finishWorkout,
  getActiveWorkout,
  getNextWorkoutTemplate,
  getRecommendedWorkoutTemplate,
  getWorkoutTemplate,
  startWorkout,
} from '@/lib/db';
import { colors, radii } from '@/lib/theme';
import type { WorkoutSession, WorkoutTemplate } from '@/lib/types';

export default function TrainScreen() {
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [nextTemplate, setNextTemplate] = useState<WorkoutTemplate | null>(null);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    const active = await getActiveWorkout();
    setActiveWorkout(active);
    const selected = active?.templateId
      ? await getWorkoutTemplate(active.templateId)
      : await getRecommendedWorkoutTemplate();
    setTemplate(selected);
    setNextTemplate(selected ? await getNextWorkoutTemplate(selected.id) : null);
  }, []);

  useFocusEffect(useCallback(() => {
    refresh().catch(() => undefined);
  }, [refresh]));

  const openExercise = (exerciseSlug: string) => {
    if (!template) return;
    router.push(`/exercise/${exerciseSlug}?templateId=${template.id}`);
  };

  const beginOrResume = async () => {
    if (starting || !template || !template.exercises.length) return;
    setStarting(true);
    try {
      const workout = activeWorkout ?? await startWorkout(template.name, template.id);
      setActiveWorkout(workout);
      openExercise(template.exercises[0].slug);
    } finally {
      setStarting(false);
    }
  };

  const confirmFinish = () => {
    if (!activeWorkout) return;
    Alert.alert(
      'Finish workout?',
      'Your completed sets and PBs will stay saved. Forge will move to the next session in your rotation.',
      [
        { text: 'Keep training', style: 'cancel' },
        {
          text: 'Finish',
          style: 'destructive',
          onPress: async () => {
            await finishWorkout(activeWorkout.id);
            await refresh();
          },
        },
      ],
    );
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
          <Eyebrow>Training</Eyebrow>
          <Title>{template.name}</Title>
          <Body style={{ marginTop: 8 }}>{template.subtitle} · {template.durationMinutes} min</Body>
        </View>
        <Pressable onPress={() => router.push('/programs')} style={styles.manageButton}>
          <MaterialCommunityIcons name="tune-variant" size={19} color={colors.accent} />
        </Pressable>
      </View>

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>{activeWorkout ? 'Session in progress' : "Today's target"}</Text>
            <Text style={styles.heroValue}>{activeWorkout ? `${template.name} · Active` : `${template.workingSets} working sets`}</Text>
          </View>
          <View style={styles.roundIcon}><MaterialCommunityIcons name={activeWorkout ? 'progress-clock' : 'dumbbell'} size={24} color={colors.accent} /></View>
        </View>
        <Text style={styles.heroCopy}>
          {activeWorkout
            ? 'Your set entries are saved locally. Pick up exactly where you left off.'
            : 'Progress a rep or a small amount of load when form stays clean. The rotation moves with your week.'}
        </Text>
        {template.exercises.length > 0 ? (
          <PrimaryButton label={activeWorkout ? 'Resume session' : 'Begin session'} icon="play" onPress={beginOrResume} />
        ) : (
          <PrimaryButton label="Add exercises" icon="plus" onPress={() => router.push(`/workout-template/${template.id}`)} />
        )}
        {activeWorkout && (
          <Pressable onPress={confirmFinish} style={styles.finishButton}>
            <MaterialCommunityIcons name="flag-checkered" size={17} color={colors.muted} />
            <Text style={styles.finishText}>Finish session</Text>
          </Pressable>
        )}
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Workout</SectionTitle>
        <Pressable onPress={() => router.push(`/workout-template/${template.id}`)}><Text style={styles.editMeta}>EDIT</Text></Pressable>
      </View>

      <View style={styles.list}>
        {template.exercises.map((exercise, index) => (
          <Pressable key={exercise.templateExerciseId} onPress={() => openExercise(exercise.slug)} style={({ pressed }) => [styles.exercise, pressed && { opacity: 0.75 }]}>
            <View style={styles.index}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.exerciseBody}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseMeta}>{exercise.targetSets} × {exercise.minReps}{exercise.minReps !== exercise.maxReps ? `–${exercise.maxReps}` : ''} · {exercise.muscle}</Text>
              <View style={styles.previousRow}>
                <Text style={styles.previousLabel}>REST</Text>
                <Text style={styles.previousValue}>{exercise.restSeconds}s</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color={colors.faint} />
          </Pressable>
        ))}
      </View>

      {nextTemplate && (
        <>
          <View style={styles.sectionHead}>
            <SectionTitle>Next up</SectionTitle>
            <Text style={styles.meta}>Rotation</Text>
          </View>
          <Card style={styles.nextCard}>
            <View style={{ flex: 1 }}><Text style={styles.nextTitle}>{nextTemplate.name}</Text><Body>{nextTemplate.subtitle}</Body></View>
            <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>{nextTemplate.durationMinutes} MIN</Text></View>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  header: { flex: 1, paddingTop: 10, marginBottom: 24 },
  manageButton: { marginTop: 8, height: 44, width: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.surface2, gap: 17 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heroLabel: { color: colors.faint, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 5 },
  roundIcon: { height: 50, width: 50, borderRadius: 25, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  finishButton: { minHeight: 44, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  finishText: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: colors.faint, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  editMeta: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  list: { borderRadius: radii.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  exercise: { minHeight: 96, paddingVertical: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 12 },
  index: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  indexText: { color: colors.faint, fontSize: 10, fontWeight: '900' },
  exerciseBody: { flex: 1 },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  exerciseMeta: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  previousRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 },
  previousLabel: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  previousValue: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  nextCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nextTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  nextBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surface3 },
  nextBadgeText: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
});
