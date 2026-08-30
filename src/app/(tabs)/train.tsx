import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { todayWorkout } from '@/lib/seed';
import { colors, radii } from '@/lib/theme';

export default function TrainScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Training</Eyebrow>
        <Title>Push Strength</Title>
        <Body style={{ marginTop: 8 }}>{todayWorkout.subtitle} · {todayWorkout.duration}</Body>
      </View>

      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>Today's target</Text>
            <Text style={styles.heroValue}>18 working sets</Text>
          </View>
          <View style={styles.roundIcon}><MaterialCommunityIcons name="dumbbell" size={24} color={colors.accent} /></View>
        </View>
        <Text style={styles.heroCopy}>Beat last session by one rep or a small weight increase. Clean form wins.</Text>
        <PrimaryButton label="Begin session" icon="play" />
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Workout</SectionTitle>
        <Text style={styles.meta}>{todayWorkout.exercises.length} exercises</Text>
      </View>

      <View style={styles.list}>
        {todayWorkout.exercises.map((exercise, index) => (
          <Pressable key={exercise.id} onPress={() => router.push(`/exercise/${exercise.id}`)} style={({ pressed }) => [styles.exercise, pressed && { opacity: 0.75 }]}>
            <View style={styles.index}><Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text></View>
            <View style={styles.exerciseBody}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseMeta}>{exercise.target} · {exercise.muscle}</Text>
              <View style={styles.previousRow}>
                <Text style={styles.previousLabel}>LAST</Text>
                <Text style={styles.previousValue}>{exercise.previous[0]}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color={colors.faint} />
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHead}>
        <SectionTitle>Next up</SectionTitle>
        <Text style={styles.meta}>Tuesday</Text>
      </View>
      <Card style={styles.nextCard}>
        <View><Text style={styles.nextTitle}>Pull Strength</Text><Body>Back · Rear delts · Biceps</Body></View>
        <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>52 MIN</Text></View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 10, marginBottom: 24 },
  hero: { backgroundColor: colors.surface2, gap: 17 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { color: colors.faint, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 5 },
  roundIcon: { height: 50, width: 50, borderRadius: 25, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { color: colors.faint, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
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
  nextCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  nextBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surface3 },
  nextBadgeText: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
});
