import { useCallback, useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Body, Eyebrow, SectionTitle, Title } from '@/components/Typography';
import { getPersonalBestHistory } from '@/lib/db';
import { colors, radii } from '@/lib/theme';
import type { PersonalBestHistoryItem } from '@/lib/types';

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function metricLabel(item: PersonalBestHistoryItem) {
  switch (item.metric) {
    case 'weight': return `${formatNumber(item.value)} kg max set`;
    case 'reps': return `${formatNumber(item.value)} reps`;
    case 'e1rm': return `${formatNumber(item.value)} kg estimated 1RM`;
    case 'volume': return `${formatNumber(item.value)} kg set volume`;
  }
}

function metricName(metric: PersonalBestHistoryItem['metric']) {
  switch (metric) {
    case 'weight': return 'LOAD';
    case 'reps': return 'REPS';
    case 'e1rm': return 'E1RM';
    case 'volume': return 'VOLUME';
  }
}

export default function PbHistoryScreen() {
  const [items, setItems] = useState<PersonalBestHistoryItem[]>([]);

  useFocusEffect(useCallback(() => {
    getPersonalBestHistory(100).then(setItems).catch(() => setItems([]));
  }, []));

  const groups = useMemo(() => {
    const grouped = new Map<string, { key: string; exerciseName: string; date: string; items: PersonalBestHistoryItem[] }>();
    for (const item of items) {
      const date = new Date(item.achievedAt);
      const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      const key = `${item.exerciseSlug}:${dayKey}`;
      const existing = grouped.get(key);
      if (existing) existing.items.push(item);
      else grouped.set(key, { key, exerciseName: item.exerciseName, date: item.achievedAt, items: [item] });
    }
    return Array.from(grouped.values());
  }, [items]);

  return (
    <Screen>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.navButton}><MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} /></Pressable>
        <Text style={styles.navTitle}>PB History</Text>
        <View style={styles.navSpacer} />
      </View>

      <Eyebrow>Progress</Eyebrow>
      <Title style={{ marginTop: 6 }}>Personal bests.</Title>
      <Body style={{ marginTop: 8 }}>Every new load, rep, estimated 1RM and set-volume record Forge has captured.</Body>

      <View style={styles.sectionHead}><SectionTitle>Timeline</SectionTitle><Text style={styles.meta}>{groups.length} achievements</Text></View>
      <View style={styles.list}>
        {items.length === 0 && (
          <Card><Text style={styles.emptyTitle}>No PBs yet</Text><Body style={{ marginTop: 5 }}>Complete working sets and Forge will build this timeline automatically.</Body></Card>
        )}
        {groups.map((group) => (
          <Card key={group.key} style={styles.row}>
            <View style={styles.icon}><MaterialCommunityIcons name="trophy-outline" size={20} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowTop}>
                <Text style={styles.exercise}>{group.exerciseName}</Text>
                <Text style={styles.metric}>{group.items.length} PB{group.items.length === 1 ? '' : 'S'}</Text>
              </View>
              <View style={styles.metricList}>
                {group.items.map((item) => (
                  <View key={item.id} style={styles.metricPill}>
                    <Text style={styles.metricPillName}>{metricName(item.metric)}</Text>
                    <Text style={styles.metricPillValue}>{metricLabel(item)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.date}>{new Date(group.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
          </Card>
        ))}
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
  icon: { height: 44, width: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  exercise: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '900' },
  metric: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  value: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 4 },
  metricList: { gap: 6, marginTop: 8 },
  metricPill: { borderRadius: radii.md, backgroundColor: colors.surface3, paddingHorizontal: 10, paddingVertical: 8 },
  metricPillName: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  metricPillValue: { color: colors.muted, fontSize: 11, fontWeight: '800', marginTop: 2 },
  date: { color: colors.faint, fontSize: 9, fontWeight: '700', marginTop: 6 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
});
