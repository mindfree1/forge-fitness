import { useCallback, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import {
  addExerciseToTemplate,
  createCustomExercise,
  deleteWorkoutTemplate,
  getExerciseLibrary,
  getWorkoutTemplate,
  removeExerciseFromTemplate,
  updateTemplateExercisePrescription,
  updateWorkoutTemplate,
} from '@/lib/db';
import { updateExerciseMedia } from '@/lib/exercises';
import { colors, radii } from '@/lib/theme';
import type { ExerciseLibraryItem, WorkoutTemplate, WorkoutTemplateExercise } from '@/lib/types';

export default function WorkoutTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const templateId = Number(id);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [library, setLibrary] = useState<ExerciseLibraryItem[]>([]);
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [duration, setDuration] = useState('50');
  const [search, setSearch] = useState('');
  const [prescription, setPrescription] = useState<WorkoutTemplateExercise | null>(null);
  const [sets, setSets] = useState('3');
  const [minReps, setMinReps] = useState('8');
  const [maxReps, setMaxReps] = useState('12');
  const [restSeconds, setRestSeconds] = useState('90');
  const [editingExercise, setEditingExercise] = useState<ExerciseLibraryItem | null>(null);
  const [exerciseVideo, setExerciseVideo] = useState('');
  const [exerciseNotes, setExerciseNotes] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [customEquipment, setCustomEquipment] = useState('');
  const [customVideo, setCustomVideo] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const load = useCallback(async () => {
    if (!Number.isFinite(templateId)) return;
    const [nextTemplate, nextLibrary] = await Promise.all([
      getWorkoutTemplate(templateId),
      getExerciseLibrary(),
    ]);
    setTemplate(nextTemplate);
    setLibrary(nextLibrary);
    if (nextTemplate) {
      setName(nextTemplate.name);
      setSubtitle(nextTemplate.subtitle);
      setDuration(String(nextTemplate.durationMinutes));
    }
  }, [templateId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  const existingIds = useMemo(() => new Set(template?.exercises.map((exercise) => exercise.id) ?? []), [template]);
  const filteredLibrary = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return library;
    return library.filter((exercise) => `${exercise.name} ${exercise.muscle} ${exercise.equipment}`.toLowerCase().includes(term));
  }, [library, search]);

  const saveDetails = async () => {
    if (!template) return;
    await updateWorkoutTemplate(template.id, {
      name,
      subtitle,
      durationMinutes: Number(duration) || template.durationMinutes,
    });
    await load();
  };

  const addExercise = async (exercise: ExerciseLibraryItem) => {
    if (!template) return;
    await addExerciseToTemplate(template.id, exercise.id);
    await load();
  };

  const confirmRemove = (exercise: WorkoutTemplateExercise) => {
    Alert.alert('Remove exercise?', `${exercise.name} will be removed from this workout only.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeExerciseFromTemplate(exercise.templateExerciseId); await load(); } },
    ]);
  };

  const openPrescription = (exercise: WorkoutTemplateExercise) => {
    setPrescription(exercise);
    setSets(String(exercise.targetSets));
    setMinReps(String(exercise.minReps));
    setMaxReps(String(exercise.maxReps));
    setRestSeconds(String(exercise.restSeconds));
  };

  const savePrescription = async () => {
    if (!prescription) return;
    await updateTemplateExercisePrescription(prescription.templateExerciseId, {
      targetSets: Number(sets) || prescription.targetSets,
      minReps: Number(minReps) || prescription.minReps,
      maxReps: Number(maxReps) || prescription.maxReps,
      restSeconds: Number(restSeconds) || prescription.restSeconds,
    });
    setPrescription(null);
    await load();
  };

  const openExerciseSettings = (exercise: ExerciseLibraryItem) => {
    setEditingExercise(exercise);
    setExerciseVideo(exercise.videoUrl ?? '');
    setExerciseNotes(exercise.techniqueNotes ?? '');
  };

  const saveExerciseSettings = async () => {
    if (!editingExercise) return;
    await updateExerciseMedia(editingExercise.id, {
      videoUrl: exerciseVideo,
      techniqueNotes: exerciseNotes,
    });
    setEditingExercise(null);
    await load();
  };

  const addCustomExercise = async () => {
    if (!template || !customName.trim()) return;
    const exerciseId = await createCustomExercise({
      name: customName,
      muscle: customMuscle,
      equipment: customEquipment,
      videoUrl: customVideo,
      techniqueNotes: customNotes,
    });
    await addExerciseToTemplate(template.id, exerciseId);
    setCustomName('');
    setCustomMuscle('');
    setCustomEquipment('');
    setCustomVideo('');
    setCustomNotes('');
    setCustomOpen(false);
    await load();
  };

  const confirmDelete = () => {
    if (!template) return;
    Alert.alert('Delete workout?', `${template.name} will be removed from your rotation. Completed workout history stays intact.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkoutTemplate(template.id);
          router.replace('/programs');
        },
      },
    ]);
  };

  if (!template) {
    return <Screen><View style={styles.nav}><Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable></View><Title>Loading workout…</Title></Screen>;
  }

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable>
        <Text style={styles.navTitle}>Edit workout</Text>
        <Pressable onPress={confirmDelete} style={styles.navButton}><MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.muted} /></Pressable>
      </View>

      <Eyebrow>Workout template</Eyebrow>
      <Title style={{ marginTop: 6 }}>{template.name}</Title>
      <Body style={{ marginTop: 8 }}>Change the session without affecting workout history you have already logged.</Body>

      <View style={styles.sectionHead}><SectionTitle>Details</SectionTitle><Text style={styles.meta}>Editable</Text></View>
      <Card style={styles.formCard}>
        <Text style={styles.label}>NAME</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.faint} />
        <Text style={styles.label}>FOCUS</Text>
        <TextInput value={subtitle} onChangeText={setSubtitle} style={styles.input} placeholder="Chest · Shoulders · Triceps" placeholderTextColor={colors.faint} />
        <Text style={styles.label}>EXPECTED MINUTES</Text>
        <TextInput value={duration} onChangeText={setDuration} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.faint} />
        <PrimaryButton label="Save workout" icon="check" onPress={saveDetails} />
      </Card>

      <View style={styles.sectionHead}><SectionTitle>Exercises</SectionTitle><Text style={styles.meta}>{template.workingSets} working sets</Text></View>
      <View style={styles.exerciseList}>
        {template.exercises.map((exercise, index) => (
          <View key={exercise.templateExerciseId} style={styles.exerciseRow}>
            <Pressable onPress={() => openPrescription(exercise)} style={styles.exerciseMain}>
              <View style={styles.index}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={styles.exerciseTitleRow}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {exercise.videoUrl ? <MaterialCommunityIcons name="youtube" size={16} color={colors.accent} /> : null}
                </View>
                <Text style={styles.exerciseMeta}>{exercise.targetSets} × {exercise.minReps}{exercise.minReps !== exercise.maxReps ? `–${exercise.maxReps}` : ''} · {exercise.restSeconds}s rest</Text>
                <Text style={styles.exerciseMuscle}>{exercise.muscle} · {exercise.equipment}</Text>
              </View>
            </Pressable>
            <View style={styles.rowActions}>
              <Pressable onPress={() => openExerciseSettings(exercise)} hitSlop={8} style={styles.actionButton}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.accent} />
              </Pressable>
              <Pressable onPress={() => confirmRemove(exercise)} hitSlop={8} style={styles.actionButton}>
                <MaterialCommunityIcons name="close" size={18} color={colors.faint} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.sectionHead}>
        <SectionTitle>Add exercise</SectionTitle>
        <Pressable onPress={() => setCustomOpen(true)} style={({ pressed }) => [styles.customButton, pressed && { opacity: 0.72 }]}>
          <MaterialCommunityIcons name="plus" size={16} color={colors.bg} />
          <Text style={styles.customButtonText}>Add custom</Text>
        </Pressable>
      </View>
      <Body style={{ marginBottom: 12 }}>Use the pencil beside any exercise to save your preferred YouTube technique video and personal form notes.</Body>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search chest, lats, cable, dumbbells…"
        placeholderTextColor={colors.faint}
        style={styles.search}
      />
      <View style={styles.libraryList}>
        {filteredLibrary.map((exercise) => {
          const added = existingIds.has(exercise.id);
          return (
            <View key={exercise.id} style={styles.libraryRow}>
              <View style={styles.libraryIcon}><MaterialCommunityIcons name="dumbbell" size={18} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <View style={styles.exerciseTitleRow}>
                  <Text style={styles.libraryName}>{exercise.name}</Text>
                  {exercise.videoUrl ? <MaterialCommunityIcons name="youtube" size={14} color={colors.accent} /> : null}
                </View>
                <Text style={styles.libraryMeta}>{exercise.muscle} · {exercise.equipment}</Text>
              </View>
              <Pressable onPress={() => openExerciseSettings(exercise)} hitSlop={8} style={styles.libraryAction}>
                <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.muted} />
              </Pressable>
              <Pressable disabled={added} onPress={() => addExercise(exercise)} hitSlop={8} style={styles.libraryAction}>
                <Text style={added ? styles.added : styles.add}>{added ? 'ADDED' : 'ADD'}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Modal visible={Boolean(prescription)} transparent animationType="fade" onRequestClose={() => setPrescription(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Eyebrow>Prescription</Eyebrow>
            <SectionTitle style={{ marginTop: 7 }}>{prescription?.name}</SectionTitle>
            <View style={styles.fieldRow}>
              <View style={styles.field}><Text style={styles.label}>SETS</Text><TextInput value={sets} onChangeText={setSets} keyboardType="number-pad" style={styles.numberInput} /></View>
              <View style={styles.field}><Text style={styles.label}>MIN REPS</Text><TextInput value={minReps} onChangeText={setMinReps} keyboardType="number-pad" style={styles.numberInput} /></View>
              <View style={styles.field}><Text style={styles.label}>MAX REPS</Text><TextInput value={maxReps} onChangeText={setMaxReps} keyboardType="number-pad" style={styles.numberInput} /></View>
            </View>
            <Text style={styles.label}>REST SECONDS</Text>
            <TextInput value={restSeconds} onChangeText={setRestSeconds} keyboardType="number-pad" style={styles.modalInput} />
            <PrimaryButton label="Save prescription" icon="check" onPress={savePrescription} />
            <Pressable onPress={() => setPrescription(null)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editingExercise)} transparent animationType="fade" onRequestClose={() => setEditingExercise(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Eyebrow>Exercise settings</Eyebrow>
            <SectionTitle style={{ marginTop: 7 }}>{editingExercise?.name}</SectionTitle>
            <Text style={styles.sharedCopy}>These settings are saved to the exercise and follow it anywhere it appears in Forge.</Text>
            <Text style={styles.label}>YOUTUBE TECHNIQUE URL</Text>
            <TextInput
              value={exerciseVideo}
              onChangeText={setExerciseVideo}
              placeholder="https://www.youtube.com/watch?v=…"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.modalInput}
            />
            <Text style={styles.label}>TECHNIQUE NOTES</Text>
            <TextInput
              value={exerciseNotes}
              onChangeText={setExerciseNotes}
              placeholder="Your cues, setup notes or reminders"
              placeholderTextColor={colors.faint}
              multiline
              textAlignVertical="top"
              style={[styles.modalInput, styles.notesInput]}
            />
            <PrimaryButton label="Save exercise settings" icon="check" onPress={saveExerciseSettings} />
            <Pressable onPress={() => setEditingExercise(null)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Eyebrow>Exercise library</Eyebrow>
            <SectionTitle style={{ marginTop: 7 }}>Create custom exercise</SectionTitle>
            <TextInput value={customName} onChangeText={setCustomName} placeholder="Exercise name" placeholderTextColor={colors.faint} style={styles.modalInput} />
            <TextInput value={customMuscle} onChangeText={setCustomMuscle} placeholder="Muscle group" placeholderTextColor={colors.faint} style={styles.modalInput} />
            <TextInput value={customEquipment} onChangeText={setCustomEquipment} placeholder="Equipment" placeholderTextColor={colors.faint} style={styles.modalInput} />
            <TextInput value={customVideo} onChangeText={setCustomVideo} placeholder="Optional YouTube/video URL" placeholderTextColor={colors.faint} autoCapitalize="none" autoCorrect={false} style={styles.modalInput} />
            <TextInput value={customNotes} onChangeText={setCustomNotes} placeholder="Optional technique notes" placeholderTextColor={colors.faint} multiline textAlignVertical="top" style={[styles.modalInput, styles.notesInput]} />
            <PrimaryButton label="Create and add" icon="plus" onPress={addCustomExercise} />
            <Pressable onPress={() => setCustomOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, marginBottom: 25 },
  navButton: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: colors.faint, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  customButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  customButtonText: { color: colors.bg, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  formCard: { gap: 10 },
  label: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  input: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14, fontWeight: '800', paddingHorizontal: 14 },
  exerciseList: { borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  exerciseRow: { minHeight: 96, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseMain: { flex: 1, minHeight: 76, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12 },
  exerciseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  index: { height: 36, width: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  indexText: { color: colors.faint, fontSize: 10, fontWeight: '900' },
  exerciseName: { color: colors.text, fontSize: 15, fontWeight: '900', flexShrink: 1 },
  exerciseMeta: { color: colors.accent, fontSize: 10, fontWeight: '900', marginTop: 5 },
  exerciseMuscle: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 50, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  libraryList: { gap: 7 },
  libraryRow: { minHeight: 68, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  libraryIcon: { height: 38, width: 38, borderRadius: 19, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  libraryName: { color: colors.text, fontSize: 13, fontWeight: '900', flexShrink: 1 },
  libraryMeta: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 3 },
  libraryAction: { minHeight: 42, minWidth: 42, alignItems: 'center', justifyContent: 'center' },
  add: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  added: { color: colors.faint, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 38, borderTopWidth: 1, borderColor: colors.border, gap: 12 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, gap: 6 },
  numberInput: { minHeight: 50, borderRadius: radii.md, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, color: colors.text, textAlign: 'center', fontSize: 18, fontWeight: '900' },
  modalInput: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, fontSize: 14, fontWeight: '800' },
  notesInput: { minHeight: 92, paddingTop: 14 },
  sharedCopy: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '600' },
  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
});