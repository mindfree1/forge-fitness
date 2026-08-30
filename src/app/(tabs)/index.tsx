import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/Card';
import { MetricTile } from '@/components/MetricTile';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { WeekStrip } from '@/components/WeekStrip';
import { useFitness } from '@/context/FitnessProvider';
import { todayWorkout } from '@/lib/seed';
import { colors, radii } from '@/lib/theme';

export default function TodayScreen() {
  const { latestWeight, addWeight } = useFitness();
  const [weightOpen, setWeightOpen] = useState(false);
  const [weight, setWeight] = useState(latestWeight?.weightKg.toFixed(1) ?? '72.8');
  const currentWeight = latestWeight?.weightKg ?? 72.8;

  return (
    <Screen>
      <View style={styles.topRow}>
        <View>
          <Eyebrow>Forge · Sunday</Eyebrow>
          <Title>Build the week.</Title>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>T</Text></View>
      </View>

      <View style={styles.metricRow}>
        <MetricTile label="Body weight" value={currentWeight.toFixed(1)} suffix="kg" detail="↓ 0.8 kg · 6 weeks" />
        <MetricTile label="Today steps" value="8,421" detail="84% of 10K goal · preview" accent />
      </View>

      <Pressable onPress={() => setWeightOpen(true)} style={styles.quickAction}>
        <MaterialCommunityIcons name="plus-circle-outline" size={19} color={colors.accent} />
        <Text style={styles.quickText}>Log today's weight</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.faint} />
      </Pressable>

      <View style={styles.sectionHead}>
        <SectionTitle>This week</SectionTitle>
        <Text style={styles.sectionMeta}>4 / 4 sessions</Text>
      </View>
      <Card>
        <View style={styles.streakRow}>
          <View>
            <Text style={styles.streakNumber}>4</Text>
            <Text style={styles.streakLabel}>workout streak</Text>
          </View>
          <View style={styles.fireBadge}><MaterialCommunityIcons name="fire" size={27} color={colors.bg} /></View>
        </View>
        <WeekStrip />
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Today's session</SectionTitle>
        <Text style={styles.sectionMeta}>{todayWorkout.duration}</Text>
      </View>
      <Card style={styles.workoutCard}>
        <View style={styles.tag}><Text style={styles.tagText}>PUSH · STRENGTH</Text></View>
        <Text style={styles.workoutTitle}>{todayWorkout.title}</Text>
        <Body>{todayWorkout.subtitle}</Body>
        <View style={styles.workoutStats}>
          <View><Text style={styles.statValue}>5</Text><Text style={styles.statLabel}>Exercises</Text></View>
          <View style={styles.rule} />
          <View><Text style={styles.statValue}>18</Text><Text style={styles.statLabel}>Working sets</Text></View>
          <View style={styles.rule} />
          <View><Text style={styles.statValue}>+4.2%</Text><Text style={styles.statLabel}>Volume target</Text></View>
        </View>
        <PrimaryButton label="Start workout" icon="lightning-bolt" onPress={() => router.push('/train')} />
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Latest PB</SectionTitle>
        <Text style={styles.sectionMeta}>8 days ago</Text>
      </View>
      <Card style={styles.pbCard}>
        <View style={styles.pbIcon}><MaterialCommunityIcons name="trophy-outline" size={24} color={colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pbExercise}>Dumbbell Bench Press</Text>
          <Text style={styles.pbValue}>15 kg × 10</Text>
        </View>
        <Text style={styles.pbDelta}>+2 reps</Text>
      </Card>

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
  avatarText: { color: colors.text, fontWeight: '900', fontSize: 15 },
  metricRow: { flexDirection: 'row', gap: 10 },
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
  pbValue: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 3 },
  pbDelta: { color: colors.accent, fontSize: 11, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 38, borderTopWidth: 1, borderColor: colors.border },
  inputRow: { flexDirection: 'row', alignItems: 'baseline', marginVertical: 26 },
  weightInput: { flex: 1, color: colors.text, fontSize: 54, fontWeight: '900', letterSpacing: -2, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8 },
  kg: { color: colors.muted, fontSize: 17, fontWeight: '800', marginLeft: 10 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
});
