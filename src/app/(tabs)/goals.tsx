import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { useFitness } from '@/context/FitnessProvider';
import type { Goal } from '@/lib/types';
import { colors, radii } from '@/lib/theme';

const icons: Record<Goal['category'], keyof typeof MaterialCommunityIcons.glyphMap> = {
  strength: 'dumbbell',
  body: 'human-male-height-variant',
  consistency: 'calendar-check-outline',
  steps: 'shoe-sneaker',
};

const categories: Array<{ value: Goal['category']; label: string }> = [
  { value: 'strength', label: 'Strength' },
  { value: 'body', label: 'Body' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'steps', label: 'Steps' },
];

type GoalDraft = {
  title: string;
  category: Goal['category'];
  currentValue: string;
  targetValue: string;
  unit: string;
};

const emptyDraft: GoalDraft = {
  title: '',
  category: 'strength',
  currentValue: '0',
  targetValue: '',
  unit: 'kg',
};

export default function GoalsScreen() {
  const { goals, toggleGoal, createGoal, updateGoal, deleteGoal } = useFitness();
  const completed = goals.filter((goal) => goal.isCompleted).length;
  const nextBenchmark = goals.find((goal) => !goal.isCompleted) ?? null;
  const [editing, setEditing] = useState<Goal | null>(null);
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setModalOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    setDraft({
      title: goal.title,
      category: goal.category,
      currentValue: String(goal.currentValue),
      targetValue: String(goal.targetValue),
      unit: goal.unit,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  };

  const saveGoal = async () => {
    const currentValue = Number(draft.currentValue);
    const targetValue = Number(draft.targetValue);
    if (!draft.title.trim()) {
      Alert.alert('Add a goal name', 'Give this benchmark a short name so Forge can track it.');
      return;
    }
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      Alert.alert('Check the target', 'Enter a target greater than zero.');
      return;
    }
    if (!Number.isFinite(currentValue) || currentValue < 0) {
      Alert.alert('Check the starting value', 'Enter zero or a positive starting value.');
      return;
    }

    setSaving(true);
    try {
      const input = {
        title: draft.title,
        category: draft.category,
        currentValue,
        targetValue,
        unit: draft.unit,
      };
      if (editing) await updateGoal(editing.id, input);
      else await createGoal(input);
      setModalOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert('Delete goal?', `${editing.title} will be removed from Forge.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(editing.id);
          setModalOpen(false);
          setEditing(null);
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Personal benchmarks</Eyebrow>
          <Title style={{ marginTop: 4 }}>Chase something.</Title>
          <Body style={{ marginTop: 8 }}>Set the targets that matter to you. Change them whenever your priorities move.</Body>
        </View>
        <Pressable onPress={openCreate} style={styles.addButton}>
          <MaterialCommunityIcons name="plus" size={23} color={colors.bg} />
        </Pressable>
      </View>

      <Card style={styles.scoreCard}>
        <View style={styles.scoreTop}>
          <View><Text style={styles.score}>{completed}/{goals.length}</Text><Text style={styles.scoreLabel}>goals completed</Text></View>
          <View style={styles.targetIcon}><MaterialCommunityIcons name="target" size={29} color={colors.bg} /></View>
        </View>
        <View style={styles.masterTrack}><View style={[styles.masterFill, { width: `${goals.length ? (completed / goals.length) * 100 : 0}%` }]} /></View>
      </Card>

      <View style={styles.sectionHead}><SectionTitle>Active goals</SectionTitle><Text style={styles.meta}>Tap card to edit</Text></View>
      {goals.length ? (
        <View style={styles.goalList}>
          {goals.map((goal) => {
            const progress = Math.max(0, Math.min(goal.currentValue / goal.targetValue, 1));
            return (
              <Card key={goal.id} style={[styles.goalCard, goal.isCompleted && styles.completedCard]}>
                <Pressable onPress={() => openEdit(goal)} style={styles.goalMain}>
                  <View style={styles.iconWrap}><MaterialCommunityIcons name={icons[goal.category]} size={20} color={goal.isCompleted ? colors.bg : colors.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.goalTitle, goal.isCompleted && styles.completedText]}>{goal.title}</Text>
                    <Text style={styles.goalNumbers}>{goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()} {goal.unit}</Text>
                  </View>
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.muted} />
                </Pressable>
                <View style={styles.goalFooter}>
                  <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
                  <Pressable
                    accessibilityLabel={goal.isCompleted ? 'Mark goal incomplete' : 'Mark goal complete'}
                    onPress={async () => {
                      Haptics.selectionAsync().catch(() => undefined);
                      await toggleGoal(goal.id, !goal.isCompleted);
                    }}
                    style={[styles.checkbox, goal.isCompleted && styles.checkboxDone]}
                  >
                    {goal.isCompleted && <MaterialCommunityIcons name="check" size={16} color={colors.bg} />}
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <Card style={styles.emptyCard}>
          <MaterialCommunityIcons name="target" size={28} color={colors.accent} />
          <Text style={styles.goalTitle}>No goals yet</Text>
          <Body>Create your first benchmark and Forge will track it here.</Body>
          <PrimaryButton label="Create goal" icon="plus" onPress={openCreate} />
        </Card>
      )}

      <View style={styles.sectionHead}><SectionTitle>Next benchmark</SectionTitle><Text style={styles.meta}>Yours</Text></View>
      {nextBenchmark ? (
        <Pressable onPress={() => openEdit(nextBenchmark)}>
          <Card style={styles.suggested}>
            <View style={styles.suggestedIcon}><MaterialCommunityIcons name="lightning-bolt-outline" size={22} color={colors.warning} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalTitle}>{nextBenchmark.title}</Text>
              <Body>{nextBenchmark.currentValue.toLocaleString()} → {nextBenchmark.targetValue.toLocaleString()} {nextBenchmark.unit}</Body>
            </View>
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.muted} />
          </Card>
        </Pressable>
      ) : (
        <Card style={styles.suggested}>
          <View style={styles.suggestedIcon}><MaterialCommunityIcons name="check-bold" size={20} color={colors.warning} /></View>
          <View style={{ flex: 1 }}><Text style={styles.goalTitle}>All current goals complete</Text><Body>Create another benchmark whenever you're ready.</Body></View>
        </Card>
      )}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <View>
                <Eyebrow>{editing ? 'Edit benchmark' : 'New benchmark'}</Eyebrow>
                <SectionTitle style={{ marginTop: 7 }}>{editing ? 'Update goal' : 'Create goal'}</SectionTitle>
              </View>
              <Pressable onPress={closeModal} style={styles.closeButton}><MaterialCommunityIcons name="close" size={20} color={colors.muted} /></Pressable>
            </View>

            <Text style={styles.label}>GOAL NAME</Text>
            <TextInput
              autoFocus
              value={draft.title}
              onChangeText={(title) => setDraft((value) => ({ ...value, title }))}
              placeholder="e.g. 10 strict pull-ups"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />

            <Text style={styles.label}>TYPE</Text>
            <View style={styles.categoryRow}>
              {categories.map((category) => {
                const selected = draft.category === category.value;
                return (
                  <Pressable
                    key={category.value}
                    onPress={() => setDraft((value) => ({ ...value, category: category.value }))}
                    style={[styles.categoryPill, selected && styles.categoryPillSelected]}
                  >
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.label}>CURRENT</Text>
                <TextInput value={draft.currentValue} onChangeText={(currentValue) => setDraft((value) => ({ ...value, currentValue }))} keyboardType="decimal-pad" style={styles.input} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>TARGET</Text>
                <TextInput value={draft.targetValue} onChangeText={(targetValue) => setDraft((value) => ({ ...value, targetValue }))} keyboardType="decimal-pad" style={styles.input} />
              </View>
            </View>

            <Text style={styles.label}>UNIT</Text>
            <TextInput
              value={draft.unit}
              onChangeText={(unit) => setDraft((value) => ({ ...value, unit }))}
              placeholder="kg, reps, sessions/wk, steps…"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />

            <PrimaryButton label={saving ? 'Saving…' : editing ? 'Save changes' : 'Create goal'} icon="check" onPress={saveGoal} />
            {editing ? <Pressable onPress={confirmDelete} style={styles.deleteButton}><MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.danger} /><Text style={styles.deleteText}>Delete goal</Text></Pressable> : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingTop: 10, marginBottom: 24, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  addButton: { marginTop: 8, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  scoreCard: { gap: 18 },
  scoreTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  scoreLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  targetIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  masterTrack: { height: 7, borderRadius: 4, backgroundColor: colors.surface3, overflow: 'hidden' },
  masterFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: colors.faint, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  goalList: { gap: 9 },
  goalCard: { padding: 15, gap: 14 },
  completedCard: { opacity: 0.62 },
  goalMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  completedText: { textDecorationLine: 'line-through' },
  goalNumbers: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  checkbox: { height: 28, width: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  suggested: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  suggestedIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: '#2B2618', alignItems: 'center', justifyContent: 'center' },
  emptyCard: { gap: 12, alignItems: 'flex-start' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 38, borderTopWidth: 1, borderColor: colors.border, gap: 12 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginTop: 2 },
  input: { minHeight: 50, borderRadius: radii.md, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14, fontWeight: '800', paddingHorizontal: 14 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPill: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border },
  categoryPillSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  categoryText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  categoryTextSelected: { color: colors.accent },
  deleteButton: { minHeight: 46, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
});
