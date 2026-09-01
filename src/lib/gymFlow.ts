import { database, saveWorkoutSet } from './db';
import type { PersonalBest, WorkoutSet, WorkoutTemplateExercise } from './types';

export type WorkoutExerciseProgress = {
  exerciseSlug: string;
  completedSets: number;
  cardioComplete: boolean;
  cardioDurationSeconds: number | null;
  cardioDistanceKm: number | null;
};

export type CardioEntry = {
  workoutId: number;
  exerciseSlug: string;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  distanceKm: number | null;
};

export type WorkoutCompletionSummary = {
  durationSeconds: number;
  completedSets: number;
  completedExercises: number;
  personalBests: number;
};

let schemaPromise: Promise<void> | null = null;

async function ensureColumn(table: string, column: string, definition: string) {
  const db = await database();
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function ensureGymFlowSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const db = await database();
      await db.execAsync(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS workout_exercise_order (
          workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
          position INTEGER NOT NULL DEFAULT 0,
          is_extra INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (workout_id, exercise_id)
        );

        CREATE TABLE IF NOT EXISTS cardio_entries (
          workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
          started_at TEXT,
          completed_at TEXT,
          duration_seconds INTEGER,
          distance_km REAL,
          PRIMARY KEY (workout_id, exercise_id)
        );
      `);
      await ensureColumn('workout_sets', 'intent_started_at', 'TEXT');
      await ensureColumn('workout_sets', 'set_completed_at', 'TEXT');
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function exerciseIdForSlug(slug: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE slug = ?', slug);
  if (!row) throw new Error(`Unknown exercise: ${slug}`);
  return row.id;
}

export async function saveTimedWorkoutSet(set: WorkoutSet): Promise<PersonalBest['metric'][]> {
  await ensureGymFlowSchema();
  const achieved = await saveWorkoutSet(set);
  const db = await database();
  const exerciseId = await exerciseIdForSlug(set.exerciseSlug);
  const now = new Date().toISOString();

  if (set.weightKg != null && set.reps != null) {
    await db.runAsync(
      `UPDATE workout_sets
       SET intent_started_at = COALESCE(intent_started_at, ?)
       WHERE workout_id = ? AND exercise_id = ? AND set_number = ?`,
      now,
      set.workoutId,
      exerciseId,
      set.setNumber,
    );
  }

  await db.runAsync(
    `UPDATE workout_sets
     SET set_completed_at = ?
     WHERE workout_id = ? AND exercise_id = ? AND set_number = ?`,
    set.completed ? now : null,
    set.workoutId,
    exerciseId,
    set.setNumber,
  );

  return achieved;
}

export async function deleteWorkoutSet(workoutId: number, exerciseSlug: string, setNumber: number) {
  await ensureGymFlowSchema();
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  await db.runAsync(
    'DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND set_number = ?',
    workoutId,
    exerciseId,
    setNumber,
  );
}

async function ensureWorkoutExerciseOrder(workoutId: number, templateId: number | null) {
  await ensureGymFlowSchema();
  if (!templateId) return;
  const db = await database();
  await db.runAsync(
    `INSERT OR IGNORE INTO workout_exercise_order (workout_id, exercise_id, position, is_extra)
     SELECT ?, wte.exercise_id, wte.position, 0
     FROM workout_template_exercises wte
     WHERE wte.template_id = ?`,
    workoutId,
    templateId,
  );
}

export async function getWorkoutExercisePlan(workoutId: number, templateId: number | null): Promise<WorkoutTemplateExercise[]> {
  await ensureWorkoutExerciseOrder(workoutId, templateId);
  const db = await database();
  const rows = await db.getAllAsync<{
    template_exercise_id: number | null;
    exercise_id: number;
    slug: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
    video_url: string | null;
    technique_notes: string | null;
    position: number;
    target_sets: number | null;
    min_reps: number | null;
    max_reps: number | null;
    rest_seconds: number | null;
  }>(
    `SELECT wte.id AS template_exercise_id,
            e.id AS exercise_id,
            e.slug,
            e.name,
            e.muscle_group,
            e.equipment,
            e.video_url,
            e.technique_notes,
            weo.position,
            wte.target_sets,
            wte.min_reps,
            wte.max_reps,
            wte.rest_seconds
     FROM workout_exercise_order weo
     JOIN exercises e ON e.id = weo.exercise_id
     LEFT JOIN workout_template_exercises wte
       ON wte.exercise_id = e.id AND wte.template_id = ?
     WHERE weo.workout_id = ?
     ORDER BY weo.position ASC, e.name ASC`,
    templateId ?? -1,
    workoutId,
  );

  return rows.map((row) => ({
    templateExerciseId: row.template_exercise_id ?? 0,
    id: row.exercise_id,
    slug: row.slug,
    name: row.name,
    muscle: row.muscle_group,
    equipment: row.equipment ?? 'Other',
    videoUrl: row.video_url,
    techniqueNotes: row.technique_notes,
    position: row.position,
    targetSets: row.target_sets ?? 3,
    minReps: row.min_reps ?? 8,
    maxReps: row.max_reps ?? 12,
    restSeconds: row.rest_seconds ?? 90,
  }));
}

export async function addExerciseToWorkout(workoutId: number, exerciseId: number) {
  await ensureGymFlowSchema();
  const db = await database();
  const last = await db.getFirstAsync<{ position: number }>(
    'SELECT position FROM workout_exercise_order WHERE workout_id = ? ORDER BY position DESC LIMIT 1',
    workoutId,
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO workout_exercise_order (workout_id, exercise_id, position, is_extra)
     VALUES (?, ?, ?, 1)`,
    workoutId,
    exerciseId,
    (last?.position ?? -1) + 1,
  );
}

export async function moveWorkoutExercise(workoutId: number, exerciseId: number, direction: 'up' | 'down') {
  await ensureGymFlowSchema();
  const db = await database();
  const rows = await db.getAllAsync<{ exercise_id: number; position: number }>(
    `SELECT exercise_id, position
     FROM workout_exercise_order
     WHERE workout_id = ?
     ORDER BY position ASC, exercise_id ASC`,
    workoutId,
  );
  const index = rows.findIndex((row) => row.exercise_id === exerciseId);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) return;
  const current = rows[index];
  const other = rows[swapIndex];
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE workout_exercise_order SET position = ? WHERE workout_id = ? AND exercise_id = ?',
      other.position,
      workoutId,
      current.exercise_id,
    );
    await db.runAsync(
      'UPDATE workout_exercise_order SET position = ? WHERE workout_id = ? AND exercise_id = ?',
      current.position,
      workoutId,
      other.exercise_id,
    );
  });
}

export async function getWorkoutExerciseProgress(workoutId: number): Promise<WorkoutExerciseProgress[]> {
  await ensureGymFlowSchema();
  const db = await database();
  const strengthRows = await db.getAllAsync<{ slug: string; completed_sets: number }>(
    `SELECT e.slug, COUNT(*) AS completed_sets
     FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_id = ? AND ws.completed = 1
     GROUP BY e.id, e.slug`,
    workoutId,
  );
  const cardioRows = await db.getAllAsync<{
    slug: string;
    completed_at: string | null;
    duration_seconds: number | null;
    distance_km: number | null;
  }>(
    `SELECT e.slug, ce.completed_at, ce.duration_seconds, ce.distance_km
     FROM cardio_entries ce
     JOIN exercises e ON e.id = ce.exercise_id
     WHERE ce.workout_id = ?`,
    workoutId,
  );

  const map = new Map<string, WorkoutExerciseProgress>();
  for (const row of strengthRows) {
    map.set(row.slug, {
      exerciseSlug: row.slug,
      completedSets: row.completed_sets,
      cardioComplete: false,
      cardioDurationSeconds: null,
      cardioDistanceKm: null,
    });
  }
  for (const row of cardioRows) {
    const current = map.get(row.slug) ?? {
      exerciseSlug: row.slug,
      completedSets: 0,
      cardioComplete: false,
      cardioDurationSeconds: null,
      cardioDistanceKm: null,
    };
    map.set(row.slug, {
      ...current,
      cardioComplete: Boolean(row.completed_at),
      cardioDurationSeconds: row.duration_seconds,
      cardioDistanceKm: row.distance_km,
    });
  }
  return Array.from(map.values());
}

export async function getCardioEntry(workoutId: number, exerciseSlug: string): Promise<CardioEntry | null> {
  await ensureGymFlowSchema();
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const row = await db.getFirstAsync<{
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
    distance_km: number | null;
  }>(
    `SELECT started_at, completed_at, duration_seconds, distance_km
     FROM cardio_entries
     WHERE workout_id = ? AND exercise_id = ?`,
    workoutId,
    exerciseId,
  );
  if (!row) return null;
  return {
    workoutId,
    exerciseSlug,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds,
    distanceKm: row.distance_km,
  };
}

export async function startCardio(workoutId: number, exerciseSlug: string) {
  await ensureGymFlowSchema();
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const startedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO cardio_entries (workout_id, exercise_id, started_at, completed_at, duration_seconds, distance_km)
     VALUES (?, ?, ?, NULL, NULL, NULL)
     ON CONFLICT(workout_id, exercise_id)
     DO UPDATE SET started_at = excluded.started_at, completed_at = NULL, duration_seconds = NULL`,
    workoutId,
    exerciseId,
    startedAt,
  );
  return getCardioEntry(workoutId, exerciseSlug);
}

export async function finishCardio(workoutId: number, exerciseSlug: string) {
  await ensureGymFlowSchema();
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const current = await getCardioEntry(workoutId, exerciseSlug);
  if (!current?.startedAt) return null;
  const completedAt = new Date().toISOString();
  const durationSeconds = Math.max(1, Math.round((Date.parse(completedAt) - Date.parse(current.startedAt)) / 1000));
  await db.runAsync(
    `UPDATE cardio_entries
     SET completed_at = ?, duration_seconds = ?
     WHERE workout_id = ? AND exercise_id = ?`,
    completedAt,
    durationSeconds,
    workoutId,
    exerciseId,
  );
  return getCardioEntry(workoutId, exerciseSlug);
}

export async function updateCardioDistance(workoutId: number, exerciseSlug: string, distanceKm: number | null) {
  await ensureGymFlowSchema();
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  await db.runAsync(
    `UPDATE cardio_entries
     SET distance_km = ?
     WHERE workout_id = ? AND exercise_id = ?`,
    distanceKm != null && Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm : null,
    workoutId,
    exerciseId,
  );
}

export async function getWorkoutCompletionSummary(workoutId: number): Promise<WorkoutCompletionSummary> {
  await ensureGymFlowSchema();
  const db = await database();
  const workout = await db.getFirstAsync<{ started_at: string; completed_at: string | null }>(
    'SELECT started_at, completed_at FROM workouts WHERE id = ?',
    workoutId,
  );
  if (!workout) return { durationSeconds: 0, completedSets: 0, completedExercises: 0, personalBests: 0 };

  const [setStats, cardioStats, pbStats] = await Promise.all([
    db.getFirstAsync<{ completed_sets: number; completed_exercises: number }>(
      `SELECT COUNT(*) AS completed_sets, COUNT(DISTINCT exercise_id) AS completed_exercises
       FROM workout_sets
       WHERE workout_id = ? AND completed = 1`,
      workoutId,
    ),
    db.getFirstAsync<{ completed_exercises: number }>(
      `SELECT COUNT(*) AS completed_exercises
       FROM cardio_entries
       WHERE workout_id = ? AND completed_at IS NOT NULL`,
      workoutId,
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM personal_bests
       WHERE achieved_at >= ? AND achieved_at <= ?`,
      workout.started_at,
      workout.completed_at ?? new Date().toISOString(),
    ),
  ]);

  const end = workout.completed_at ? Date.parse(workout.completed_at) : Date.now();
  const start = Date.parse(workout.started_at);
  return {
    durationSeconds: Number.isFinite(start) ? Math.max(0, Math.round((end - start) / 1000)) : 0,
    completedSets: setStats?.completed_sets ?? 0,
    completedExercises: (setStats?.completed_exercises ?? 0) + (cardioStats?.completed_exercises ?? 0),
    personalBests: pbStats?.count ?? 0,
  };
}
