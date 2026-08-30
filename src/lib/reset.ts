import * as SQLite from 'expo-sqlite';

export async function resetTrackingData() {
  const db = await SQLite.openDatabaseAsync('forge.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets');
    await db.runAsync('DELETE FROM personal_bests');
    await db.runAsync('DELETE FROM workouts');
    await db.runAsync('DELETE FROM weight_entries');

    // Keep one invisible sentinel row so the demo weight seed is not restored
    // the next time Forge starts. FitnessProvider filters non-positive values.
    await db.runAsync(
      'INSERT INTO weight_entries (weight_kg, recorded_at) VALUES (?, ?)',
      0,
      '1970-01-01T00:00:00.000Z',
    );

    // Keep the goal definitions but clear all demo progress, including steps.
    await db.runAsync('UPDATE goals SET current_value = 0, is_completed = 0');
  });
}
