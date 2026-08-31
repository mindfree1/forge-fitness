import { database } from './db';

export async function resetTrackingData() {
  const db = await database();
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets');
    await db.runAsync('DELETE FROM personal_bests');
    await db.runAsync('DELETE FROM workouts');
    await db.runAsync('DELETE FROM weight_entries');
    await db.runAsync('UPDATE goals SET current_value = 0, is_completed = 0');
  });
}
