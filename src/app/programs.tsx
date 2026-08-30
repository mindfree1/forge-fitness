import { useCallback, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { useFitness } from '@/context/FitnessProvider';
import { createWorkoutTemplate, getActiveProgram, getWorkoutTemplates, updateProgram } from '@/lib/db';
import { colors, radii } from '@/lib/theme';
import type { Program, WorkoutTemplate } from '@/lib/types';

export default function ProgramsScreen() {
  const { resetTracking } = useFitness();
  const [program, setProgram] = useState<Program | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [newWorkoutSubtitle, setNewWorkoutSubtitle] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const active = await getActiveProgram();
    setProgram(active);
    if (!active) {
      setTemplates([]);
      return;
    }
    setName(active.name);
    setGoal(active.goal);
    setTemplates(await getWorkoutTemplates(active.id));
  }, []);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  const changeFrequency = async (delta: number) => {
    if (!program) return;
    const next = Math.max(1, Math.min(7, program.targetSessionsPerWeek + delta));
    await updateProgram(program.id, { targetSessionsPerWeek: next });
    await load();
  };

  const saveIdentity = async () => {
    if (!program) return;
    await updateProgram(program.id, { name, goal });
    await load();
  };

  const addWorkout = async () => {
    if (!program) return;
    const id = await createWorkoutTemplate(program.id, newWorkoutName, newWorkoutSubtitle);
    setNewWorkoutName('');
    setNewWorkoutSubtitle('');
    setAddOpen(false);
    await load();
    router.push({
      pathname: '/workout-template/[id]',
      params: { id: String(id) },
    });
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset tracking data?',
      'This clears workout history, working sets, PBs, weigh-ins and demo goal progress. Your program, workout rotation, custom exercises and technique videos stay intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await resetTracking();
              Alert.alert('Reset complete', 'Forge is clean and ready for your first real session.');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.navTitle}>My Program</Text>
        <View style={styles.navSpacer} />
      </View>

      <Eyebrow>Training system</Eyebrow>
      <Title style={{ marginTop: 6 }}>Build around real life.</Title>
      <Body style={{ marginTop: 8 }}>
        Forge follows your workout rotation, not fixed weekdays. Train an extra day or miss one and the next session simply moves with you.
      </Body>

      {program && (
        <>
          <View style={styles.sectionHead}><SectionTitle>Program focus</SectionTitle><Text style={styles.meta}>Editable</Text></View>
          <Card style={styles.formCard}>
            <Text style={styles.label}>PROGRAM NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Program name" placeholderTextColor={colors.faint} />
            <Text style={styles.label}>PRIMARY GOAL</Text>
            <TextInput value={goal} onChangeText={setGoal} style={styles.input} placeholder="e.g. V-taper athletic build" placeholderTextColor={colors.faint} />
            <PrimaryButton label="Save program" icon="check" onPress={saveIdentity} />
          </Card>

          <View style={styles.sectionHead}><SectionTitle>Weekly target</SectionTitle><Text style={styles.meta}>Flexible</Text></View>
          <Card style={styles.frequencyCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.frequencyValue}>{program.targetSessionsPerWeek}</Text>
              <Text style={styles.frequencyLabel}>sessions per week</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={() => changeFrequency(-1)} style={styles.stepButton}><MaterialCommunityIcons name="minus" size={20} color={colors.text} /></Pressable>
              <Pressable onPress={() => changeFrequency(1)} style={styles.stepButton}><MaterialCommunityIcons name="plus" size={20} color={colors.bg} /></Pressable>
            </View>
          </Card>

          <View style={styles.sectionHead}><SectionTitle>Workout rotation</SectionTitle><Text style={styles.meta}>{templates.length} sessions</Text></View>
          <View style={styles.templateList}>
            {templates.map((template, index) => (
              <Pressable
                key={template.id}
                onPress={() =>
                  router.push({
                    pathname: '/workout-template/[id]',
                    params: { id: String(template.id) },
                  })
                }
                style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.index}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateSubtitle}>{template.subtitle}</Text>
                  <Text style={styles.templateMeta}>{template.exerciseCount} exercises · {template.workingSets} sets · {template.durationMinutes} min</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.faint} />
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => setAddOpen(true)} style={styles.addWorkout}>
            <MaterialCommunityIcons name="plus" size={20} color={colors.accent} />
            <Text style={styles.addWorkoutText}>Add workout</Text>
          </Pressable>
        </>
      )}

      <View style={styles.sectionHead}><SectionTitle>Testing & data</SectionTitle><Text style={styles.meta}>Gym ready</Text></View>
      <Card style={styles.resetCard}>
        <View style={styles.resetIcon}><MaterialCommunityIcons name="restart" size={22} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.resetTitle}>Start with a clean slate</Text>
          <Body>Clears test history and fake progress, but keeps your program, custom exercises and video links.</Body>
        </View>
        <Pressable disabled={resetting} onPress={confirmReset} style={({ pressed }) => [styles.resetButton, pressed && { opacity: 0.72 }, resetting && { opacity: 0.5 }]}>
          <Text style={styles.resetButtonText}>{resetting ? 'Resetting…' : 'Reset data'}</Text>
        </Pressable>
      </Card>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Eyebrow>New session</Eyebrow>
            <SectionTitle style={{ marginTop: 7 }}>Create workout</SectionTitle>
            <TextInput
              autoFocus
              value={newWorkoutName}
              onChangeText={setNewWorkoutName}
              placeholder="Workout name"
              placeholderTextColor={colors.faint}
              style={styles.modalInput}
            />
            <TextInput
              value={newWorkoutSubtitle}
              onChangeText={setNewWorkoutSubtitle}
              placeholder="Focus e.g. Chest · Shoulders"
              placeholderTextColor={colors.faint}
              style={styles.modalInput}
            />
            <PrimaryButton label="Create workout" icon="plus" onPress={addWorkout} />
            <Pressable onPress={() => setAddOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
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
  navSpacer: { height: 42, width: 42 },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: colors.faint, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  formCard: { gap: 10 },
  label: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginTop: 2 },
  input: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14, fontWeight: '800', paddingHorizontal: 14 },
  frequencyCard: { flexDirection: 'row', alignItems: 'center' },
  frequencyValue: { color: colors.text, fontSize: 38, fontWeight: '900', letterSpacing: -1.2 },
  frequencyLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  stepper: { flexDirection: 'row', gap: 8 },
  stepButton: { height: 46, width: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  templateList: { borderRadius: radii.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  templateCard: { minHeight: 96, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  index: { height: 36, width: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  indexText: { color: colors.faint, fontSize: 10, fontWeight: '900' },
  templateName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  templateSubtitle: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  templateMeta: { color: colors.accent, fontSize: 9, fontWeight: '900', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  addWorkout: { marginTop: 12, minHeight: 52, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  addWorkoutText: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  resetCard: { gap: 13 },
  resetIcon: { height: 44, width: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  resetTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  resetButton: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  resetButtonText: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 38, borderTopWidth: 1, borderColor: colors.border, gap: 12 },
  modalInput: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, fontSize: 14, fontWeight: '800' },
  cancel: { padding: 12, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
});