import { useCallback, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { deleteWorkout, getWorkoutHistory } from '@/lib/db';
import { colors, radii } from '@/lib/theme';
import type { WorkoutSession } from '@/lib/types';

function formatDuration(session: WorkoutSession) {
  if (!session.completedAt) return 'Unfinished';
  const seconds = Math.max(0, Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)} min`;
}

export default function SessionHistoryScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const refresh = useCallback(() => {
    getWorkoutHistory(100).then(setSessions).catch(() => setSessions([]));
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const confirmDelete = (session: WorkoutSession) => {
    Alert.alert(
      'Delete this session?',
      'The workout and all logged sets will be removed. Forge will rebuild PB history from the sessions that remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete session',
          style: 'destructive',
          onPress: () => {
            deleteWorkout(session.id).then(refresh).catch(() => undefined);
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable>
        <Text style={styles.navTitle}>Session history</Text>
        <View style={styles.navSpacer} />
      </View>

      <Eyebrow>Training</Eyebrow>
      <Title style={{ marginTop: 6 }}>Your sessions.</Title>
      <Body style={{ marginTop: 8 }}>Completed and unfinished workouts stay editable rather than becoming permanent mistakes.</Body>

      <View style={styles.sectionHead}><SectionTitle>History</SectionTitle><Text style={styles.meta}>{sessions.length} sessions</Text></View>
      <View style={styles.list}>
        {!sessions.length ? (
          <Card><Text style={styles.emptyTitle}>No sessions yet</Text><Body style={{ marginTop: 5 }}>Start a workout and it will appear here.</Body></Card>
        ) : sessions.map((session) => {
          const unfinished = !session.completedAt;
          const date = new Date(session.startedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
          return (
            <Card key={session.id} style={styles.row}>
              <View style={[styles.icon, unfinished && styles.unfinishedIcon]}>
                <MaterialCommunityIcons name={unfinished ? 'timer-alert-outline' : 'check-bold'} size={20} color={unfinished ? colors.accent : colors.bg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionName}>{session.name}</Text>
                <Text style={styles.sessionMeta}>{date} · {formatDuration(session)}</Text>
                {unfinished ? <Text style={styles.unfinished}>UNFINISHED SESSION</Text> : null}
              </View>
              <Pressable onPress={() => confirmDelete(session)} style={styles.deleteButton} accessibilityLabel={`Delete ${session.name}`}>
                <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.danger} />
              </Pressable>
            </Card>
          );
        })}
      </View>
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
  list: { gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  unfinishedIcon: { backgroundColor: colors.accentSoft },
  sessionName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  sessionMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 4 },
  unfinished: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 6 },
  deleteButton: { width: 42, height: 42, borderRadius: radii.pill, backgroundColor: '#2A1715', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
});
