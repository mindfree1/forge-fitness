import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/lib/theme';
import { weekActivity } from '@/lib/seed';

export type WeekActivityItem = {
  day: string;
  done: boolean;
  today?: boolean;
};

export function WeekStrip({ activity = weekActivity }: { activity?: readonly WeekActivityItem[] }) {
  return (
    <View style={styles.row}>
      {activity.map((item, index) => (
        <View key={`${item.day}-${index}`} style={styles.item}>
          <Text style={[styles.day, item.today && styles.todayText]}>{item.day}</Text>
          <View style={[styles.dot, item.done && styles.done, item.today && styles.today]}>
            {item.done ? <MaterialCommunityIcons name="check" size={15} color={colors.bg} /> : <View style={styles.innerDot} />}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  item: { alignItems: 'center', gap: 8 },
  day: { color: colors.faint, fontSize: 11, fontWeight: '800' },
  todayText: { color: colors.text },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: colors.accent },
  today: { borderWidth: 1, borderColor: colors.text },
  innerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.faint },
});
