import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
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

export default function GoalsScreen() {
  const { goals, toggleGoal } = useFitness();
  const completed = goals.filter((goal) => goal.isCompleted).length;

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>2026 benchmarks</Eyebrow>
        <Title>Chase something.</Title>
        <Body style={{ marginTop: 8 }}>Clear targets. Small jumps. No fake urgency.</Body>
      </View>

      <Card style={styles.scoreCard}>
        <View style={styles.scoreTop}>
          <View><Text style={styles.score}>{completed}/{goals.length}</Text><Text style={styles.scoreLabel}>goals completed</Text></View>
          <View style={styles.targetIcon}><MaterialCommunityIcons name="target" size={29} color={colors.bg} /></View>
        </View>
        <View style={styles.masterTrack}><View style={[styles.masterFill, { width: `${goals.length ? (completed / goals.length) * 100 : 0}%` }]} /></View>
      </Card>

      <View style={styles.sectionHead}><SectionTitle>Active goals</SectionTitle><Text style={styles.meta}>Tap to complete</Text></View>
      <View style={styles.goalList}>
        {goals.map((goal) => {
          const progress = Math.max(0, Math.min(goal.currentValue / goal.targetValue, 1));
          return (
            <Pressable
              key={goal.id}
              onPress={async () => {
                Haptics.selectionAsync().catch(() => undefined);
                await toggleGoal(goal.id, !goal.isCompleted);
              }}
            >
              <Card style={[styles.goalCard, goal.isCompleted && styles.completedCard]}>
                <View style={styles.goalHead}>
                  <View style={styles.iconWrap}><MaterialCommunityIcons name={icons[goal.category]} size={20} color={goal.isCompleted ? colors.bg : colors.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.goalTitle, goal.isCompleted && styles.completedText]}>{goal.title}</Text>
                    <Text style={styles.goalNumbers}>{goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()} {goal.unit}</Text>
                  </View>
                  <View style={[styles.checkbox, goal.isCompleted && styles.checkboxDone]}>
                    {goal.isCompleted && <MaterialCommunityIcons name="check" size={16} color={colors.bg} />}
                  </View>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${progress * 100}%` }]} /></View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHead}><SectionTitle>Next benchmark</SectionTitle><Text style={styles.meta}>Suggested</Text></View>
      <Card style={styles.suggested}>
        <View style={styles.suggestedIcon}><MaterialCommunityIcons name="lightning-bolt-outline" size={22} color={colors.warning} /></View>
        <View style={{ flex: 1 }}><Text style={styles.goalTitle}>17.5 kg dumbbell bench</Text><Body>When you can hit 15 kg × 10 cleanly across your working sets.</Body></View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 10, marginBottom: 24 },
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
  goalHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  completedText: { textDecorationLine: 'line-through' },
  goalNumbers: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  checkbox: { height: 28, width: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  suggested: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  suggestedIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: '#2B2618', alignItems: 'center', justifyContent: 'center' },
});
