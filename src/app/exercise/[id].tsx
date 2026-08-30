import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { todayWorkout } from '@/lib/seed';
import { colors, radii } from '@/lib/theme';

type SetRow = { kg: string; reps: string; complete: boolean };

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useMemo(() => todayWorkout.exercises.find((item) => item.id === id) ?? todayWorkout.exercises[0], [id]);
  const [sets, setSets] = useState<SetRow[]>(exercise.previous.map((entry) => {
    const [kg, reps] = entry.split(' × ');
    return { kg, reps, complete: false };
  }));

  const updateSet = (index: number, field: 'kg' | 'reps', value: string) => {
    setSets((current) => current.map((set, setIndex) => setIndex === index ? { ...set, [field]: value } : set));
  };

  const toggleComplete = (index: number) => {
    Haptics.selectionAsync().catch(() => undefined);
    setSets((current) => current.map((set, setIndex) => setIndex === index ? { ...set, complete: !set.complete } : set));
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable>
        <Text style={styles.navTitle}>Exercise</Text>
        <Pressable style={styles.navButton}><MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.text} /></Pressable>
      </View>

      <Eyebrow>{exercise.muscle}</Eyebrow>
      <Title style={{ marginTop: 6 }}>{exercise.name}</Title>
      <Body style={{ marginTop: 9 }}>{exercise.equipment} · Target {exercise.target}</Body>

      <Card style={styles.performanceCard}>
        <View><Text style={styles.micro}>CURRENT PB</Text><Text style={styles.big}>15 kg × 10</Text></View>
        <View style={styles.pbBadge}><MaterialCommunityIcons name="trophy" size={21} color={colors.bg} /></View>
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Working sets</SectionTitle>
        <Text style={styles.rest}>REST 01:30</Text>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.columnHead, { width: 42 }]}>SET</Text>
        <Text style={[styles.columnHead, { flex: 1 }]}>PREVIOUS</Text>
        <Text style={[styles.columnHead, { width: 72, textAlign: 'center' }]}>KG</Text>
        <Text style={[styles.columnHead, { width: 64, textAlign: 'center' }]}>REPS</Text>
        <View style={{ width: 42 }} />
      </View>
      <View style={styles.setList}>
        {sets.map((set, index) => (
          <View key={index} style={[styles.setRow, set.complete && styles.setComplete]}>
            <Text style={styles.setNumber}>{index + 1}</Text>
            <Text style={styles.previous}>{exercise.previous[index] ?? '—'}</Text>
            <TextInput value={set.kg} onChangeText={(value) => updateSet(index, 'kg', value)} keyboardType="decimal-pad" style={styles.setInput} selectTextOnFocus />
            <TextInput value={set.reps} onChangeText={(value) => updateSet(index, 'reps', value)} keyboardType="number-pad" style={styles.repInput} selectTextOnFocus />
            <Pressable onPress={() => toggleComplete(index)} style={[styles.check, set.complete && styles.checkDone]}>
              {set.complete && <MaterialCommunityIcons name="check" size={17} color={colors.bg} />}
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable onPress={() => setSets((current) => [...current, { kg: '', reps: '', complete: false }])} style={styles.addSet}>
        <MaterialCommunityIcons name="plus" size={18} color={colors.accent} /><Text style={styles.addSetText}>Add set</Text>
      </Pressable>

      <View style={styles.sectionHead}><SectionTitle>Technique</SectionTitle><Text style={styles.rest}>VIDEO NEXT</Text></View>
      <Card style={styles.techniqueCard}>
        <View style={styles.videoPlaceholder}>
          <View style={styles.play}><MaterialCommunityIcons name="play" size={24} color={colors.bg} /></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.techniqueTitle}>Keep the rep clean</Text>
          <Body>Retract shoulder blades, keep elbows around 45°, and lower under control.</Body>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, marginBottom: 25 },
  navButton: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  performanceCard: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  micro: { color: colors.faint, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  big: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  pbBadge: { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { marginTop: 30, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rest: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 7 },
  columnHead: { color: colors.faint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  setList: { gap: 7 },
  setRow: { minHeight: 58, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  setComplete: { borderColor: '#344324', backgroundColor: '#141A10' },
  setNumber: { width: 42, color: colors.muted, fontSize: 12, fontWeight: '900' },
  previous: { flex: 1, color: colors.faint, fontSize: 11, fontWeight: '700' },
  setInput: { width: 72, color: colors.text, textAlign: 'center', fontSize: 15, fontWeight: '900', paddingVertical: 10 },
  repInput: { width: 64, color: colors.text, textAlign: 'center', fontSize: 15, fontWeight: '900', paddingVertical: 10 },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  checkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  addSet: { marginTop: 10, height: 48, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  addSetText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  techniqueCard: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  videoPlaceholder: { width: 90, height: 78, borderRadius: radii.md, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  play: { height: 38, width: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  techniqueTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 5 },
});
