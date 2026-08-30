import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PropsWithChildren, useMemo, useState } from 'react';
import type { ColorValue, LayoutChangeEvent, ViewStyle } from 'react-native';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { colors, radii } from '@/lib/theme';
import type { MuscleVolumeRow, ProgressRange, RecentAchievement } from '@/lib/analytics';
import { progressRanges } from '@/lib/analytics';

export function AnalyticsCard({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <Card style={[styles.card, style]}>{children}</Card>;
}

export function ProgressRangeSelector({ value, onChange }: { value: ProgressRange; onChange: (range: ProgressRange) => void }) {
  return (
    <View style={styles.rangeShell}>
      {progressRanges.map((range) => {
        const selected = range === value;
        return (
          <Pressable
            key={range}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(range)}
            style={({ pressed }) => [styles.rangeOption, selected && styles.rangeOptionSelected, pressed && styles.pressed]}
          >
            <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>{range}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AnalyticsCardHeader({
  icon,
  title,
  subtitle,
  accent = colors.accent,
  right,
  onTitlePress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  accent?: ColorValue;
  right?: React.ReactNode;
  onTitlePress?: () => void;
}) {
  const titleContent = (
    <View style={styles.headerTitleWrap}>
      <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
      {onTitlePress ? <MaterialCommunityIcons name="chevron-down" size={17} color={colors.muted} /> : null}
    </View>
  );

  return (
    <View style={styles.cardHeader}>
      <View style={styles.headerLeft}>
        <View style={styles.iconWrap}><MaterialCommunityIcons name={icon} size={22} color={accent} /></View>
        <View style={styles.headerCopy}>
          {onTitlePress ? <Pressable onPress={onTitlePress}>{titleContent}</Pressable> : titleContent}
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

export function MetricSelectPill({ label, onPress, accent = colors.accent }: { label: string; onPress?: () => void; accent?: ColorValue }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.metricPill, pressed && onPress && styles.pressed]}
    >
      <Text style={[styles.metricPillText, { color: accent }]}>{label}</Text>
      {onPress ? <MaterialCommunityIcons name="chevron-down" size={17} color={accent} /> : null}
    </Pressable>
  );
}

export function AnalyticsEmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.stateWrap}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDetail}>{detail}</Text>
    </View>
  );
}

export function AnalyticsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <Text style={styles.stateTitle}>Couldn’t load this data</Text>
      <Pressable onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable>
    </View>
  );
}

export function AnalyticsSkeleton({ height = 128 }: { height?: number }) {
  return (
    <View style={[styles.skeleton, { minHeight: height }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function InsightRow({ text, accent = colors.accent }: { text: string; accent?: ColorValue }) {
  return (
    <View style={styles.insightRow}>
      <MaterialCommunityIcons name="trending-up" size={18} color={accent} />
      <Text style={[styles.insightText, { color: accent }]}>{text}</Text>
    </View>
  );
}

type ChartPoint = { label: string; value: number };

export function BarChart({ points, accent = '#6D9CFF', height = 126 }: { points: ChartPoint[]; accent?: ColorValue; height?: number }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  const labelStep = Math.max(1, Math.ceil(points.length / 5));

  return (
    <View style={[styles.barChart, { height }]}> 
      <View style={[styles.guide, { top: '25%' }]} />
      <View style={[styles.guide, { top: '50%' }]} />
      <View style={[styles.guide, { top: '75%' }]} />
      <View style={styles.barPlot}>
        {points.map((point, index) => {
          const barHeight = point.value === 0 ? 2 : Math.max(7, (point.value / max) * (height - 30));
          const showLabel = index === 0 || index === points.length - 1 || index % labelStep === 0;
          return (
            <View key={`${point.label}-${index}`} style={styles.barColumn}>
              <View style={[styles.bar, { height: barHeight, backgroundColor: accent }]} />
              <Text style={[styles.axisLabel, !showLabel && styles.axisLabelHidden]} numberOfLines={1}>{showLabel ? point.label : ' '}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function LineChart({ points, accent = colors.accent, height = 142 }: { points: ChartPoint[]; accent?: ColorValue; height?: number }) {
  const [width, setWidth] = useState(0);
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max) * 0.05, 0.1);
  const plotHeight = height - 28;
  const labelStep = Math.max(1, Math.ceil(points.length / 4));

  const positions = useMemo(() => {
    if (!width || !points.length) return [];
    const inset = 7;
    const usableWidth = Math.max(1, width - inset * 2);
    return points.map((point, index) => ({
      x: points.length === 1 ? width / 2 : inset + (index / (points.length - 1)) * usableWidth,
      y: 8 + ((max - point.value) / range) * Math.max(1, plotHeight - 18),
    }));
  }, [max, plotHeight, points, range, width]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={[styles.lineChart, { height }]} onLayout={onLayout}>
      <View style={[styles.guide, { top: '25%' }]} />
      <View style={[styles.guide, { top: '50%' }]} />
      <View style={[styles.guide, { top: '75%' }]} />
      {positions.slice(0, -1).map((point, index) => {
        const next = positions[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        return (
          <View
            key={`line-${index}`}
            style={[
              styles.lineSegment,
              {
                left: (point.x + next.x) / 2 - length / 2,
                top: (point.y + next.y) / 2 - 1,
                width: length,
                backgroundColor: accent,
                transform: [{ rotateZ: `${angle}rad` }],
              },
            ]}
          />
        );
      })}
      {positions.map((point, index) => (
        <View
          key={`point-${index}`}
          style={[styles.linePoint, { left: point.x - 4, top: point.y - 4, backgroundColor: accent }]}
        />
      ))}
      <View style={styles.lineLabels}>
        {points.map((point, index) => {
          const showLabel = index === 0 || index === points.length - 1 || index % labelStep === 0;
          return <Text key={`${point.label}-${index}`} style={[styles.lineAxisLabel, !showLabel && styles.axisLabelHidden]}>{showLabel ? point.label : ' '}</Text>;
        })}
      </View>
    </View>
  );
}

function achievementValueText(item: RecentAchievement) {
  const delta = item.previousValue == null ? null : item.value - item.previousValue;
  const format = (value: number) => Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  if (item.metric === 'reps') return delta != null && delta > 0 ? `+${format(delta)} reps` : `${format(item.value)} reps`;
  if (item.metric === 'volume') return delta != null && delta > 0 ? `+${Math.round(delta).toLocaleString('en-AU')} kg` : `${Math.round(item.value).toLocaleString('en-AU')} kg`;
  return delta != null && delta > 0 ? `+${format(delta)} kg` : `${format(item.value)} kg`;
}

export function RecentAchievementStrip({ items }: { items: RecentAchievement[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementStrip}>
      {items.map((item) => (
        <View key={item.id} style={styles.achievementTile}>
          <View style={styles.achievementIcon}><MaterialCommunityIcons name="trophy-outline" size={20} color={colors.accent} /></View>
          <View style={styles.achievementCopy}>
            <Text style={styles.achievementTitle} numberOfLines={1}>{item.exerciseName}</Text>
            <Text style={styles.achievementValue}>{achievementValueText(item)}</Text>
            <Text style={styles.achievementDate}>{new Date(item.achievedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function MuscleBalanceBars({ rows }: { rows: MuscleVolumeRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.volumeKg));
  return (
    <View style={styles.muscleList}>
      {rows.slice(0, 6).map((row) => (
        <View key={row.muscle} style={styles.muscleRow}>
          <Text style={styles.muscleLabel}>{row.muscle}</Text>
          <View style={styles.muscleTrack}><View style={[styles.muscleFill, { width: `${Math.max(4, (row.volumeKg / max) * 100)}%` }]} /></View>
          <Text style={styles.muscleValue}>{Math.round(row.volumeKg).toLocaleString('en-AU')} kg</Text>
        </View>
      ))}
    </View>
  );
}

export function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Array<{ label: string; value: string }>;
  selectedValue?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><MaterialCommunityIcons name="close" size={22} color={colors.muted} /></Pressable>
          </View>
          <ScrollView style={styles.modalScroll}>
            {options.map((option) => {
              const selected = option.value === selectedValue;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => { onSelect(option.value); onClose(); }}
                  style={({ pressed }) => [styles.modalOption, selected && styles.modalOptionSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}>{option.label}</Text>
                  {selected ? <MaterialCommunityIcons name="check" size={20} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16 },
  rangeShell: { flexDirection: 'row', backgroundColor: '#171916', borderRadius: radii.pill, padding: 3, marginTop: 14, marginBottom: 16 },
  rangeOption: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill },
  rangeOptionSelected: { backgroundColor: colors.accent },
  rangeText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  rangeTextSelected: { color: '#10120E' },
  pressed: { opacity: 0.72 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, minWidth: 0 },
  iconWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  cardSubtitle: { color: colors.muted, fontSize: 11, marginTop: 1, fontWeight: '600' },
  metricPill: { minHeight: 38, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  metricPillText: { fontSize: 12, fontWeight: '800' },
  stateWrap: { minHeight: 110, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 18 },
  stateTitle: { color: colors.text, fontWeight: '800', fontSize: 14, textAlign: 'center' },
  stateDetail: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: 'center' },
  retryButton: { marginTop: 10, minHeight: 36, paddingHorizontal: 16, borderRadius: radii.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, justifyContent: 'center' },
  retryText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  skeleton: { alignItems: 'center', justifyContent: 'center' },
  insightRow: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 7 },
  insightText: { flex: 1, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  barChart: { position: 'relative', marginTop: 8 },
  barPlot: { position: 'absolute', left: 0, right: 0, top: 3, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', minWidth: 3 },
  bar: { width: '68%', maxWidth: 18, minWidth: 3, borderRadius: 3 },
  guide: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  axisLabel: { color: colors.faint, fontSize: 9, marginTop: 5, width: 34, textAlign: 'center' },
  axisLabelHidden: { opacity: 0 },
  lineChart: { position: 'relative', marginTop: 8, overflow: 'hidden' },
  lineSegment: { position: 'absolute', height: 2, borderRadius: 2 },
  linePoint: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.surface },
  lineLabels: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between' },
  lineAxisLabel: { flex: 1, color: colors.faint, fontSize: 9, textAlign: 'center' },
  achievementStrip: { paddingTop: 12, paddingBottom: 2 },
  achievementTile: { width: 158, minHeight: 82, marginRight: 10, paddingRight: 10, flexDirection: 'row', alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  achievementIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  achievementCopy: { flex: 1, minWidth: 0 },
  achievementTitle: { color: colors.text, fontSize: 11, fontWeight: '700' },
  achievementValue: { color: colors.accent, fontSize: 15, fontWeight: '900', marginTop: 2 },
  achievementDate: { color: colors.faint, fontSize: 9, marginTop: 3 },
  muscleList: { marginTop: 13, gap: 10 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscleLabel: { color: colors.muted, fontSize: 11, width: 64 },
  muscleTrack: { flex: 1, height: 5, borderRadius: 4, backgroundColor: colors.surface3, overflow: 'hidden' },
  muscleFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  muscleValue: { color: colors.muted, fontSize: 10, width: 72, textAlign: 'right' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end', padding: 14 },
  modalCard: { maxHeight: '72%', backgroundColor: colors.surface2, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  modalScroll: { flexGrow: 0 },
  modalOption: { minHeight: 48, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalOptionSelected: { backgroundColor: colors.accentSoft },
  modalOptionText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  modalOptionTextSelected: { color: colors.text },
});
