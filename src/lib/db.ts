import * as SQLite from 'expo-sqlite';
import { defaultProgramSeed, exerciseLibrarySeed } from './seed';
import type {
  ExerciseLibraryItem,
  Goal,
  PersonalBest,
  PersonalBestHistoryItem,
  Program,
  StrengthTrend,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from './types';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function database() {
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync('forge.db');
  return databasePromise;
}

async function ensureColumn(db: SQLite.SQLiteDatabase, table: string, column: string, definition: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function initialiseDatabase() {
  const db = await database();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS weight_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      current_value REAL NOT NULL DEFAULT 0,
      target_value REAL NOT NULL,
      unit TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      equipment TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_set_unique
      ON workout_sets(workout_id, exercise_id, set_number);

    CREATE TABLE IF NOT EXISTS personal_bests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      achieved_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      goal TEXT NOT NULL,
      target_sessions_per_week INTEGER NOT NULL DEFAULT 4,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 50,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_template_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      target_sets INTEGER NOT NULL DEFAULT 3,
      min_reps INTEGER NOT NULL DEFAULT 8,
      max_reps INTEGER NOT NULL DEFAULT 12,
      rest_seconds INTEGER NOT NULL DEFAULT 90,
      UNIQUE(template_id, exercise_id)
    );
  `);

  await ensureColumn(db, 'exercises', 'video_url', 'TEXT');
  await ensureColumn(db, 'exercises', 'technique_notes', 'TEXT');
  await ensureColumn(db, 'workouts', 'template_id', 'INTEGER REFERENCES workout_templates(id)');

  for (const exercise of exerciseLibrarySeed) {
    await db.runAsync(
      `INSERT INTO exercises (slug, name, muscle_group, equipment, technique_notes)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         muscle_group = excluded.muscle_group,
         equipment = excluded.equipment,
         technique_notes = COALESCE(exercises.technique_notes, excluded.technique_notes)`,
      exercise.slug,
      exercise.name,
      exercise.muscle,
      exercise.equipment,
      exercise.techniqueNotes,
    );
  }

  const programCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM programs');
  if (!programCount?.count) {
    const result = await db.runAsync(
      'INSERT INTO programs (name, goal, target_sessions_per_week, is_active) VALUES (?, ?, ?, 1)',
      defaultProgramSeed.name,
      defaultProgramSeed.goal,
      defaultProgramSeed.targetSessionsPerWeek,
    );
    const programId = Number(result.lastInsertRowId);

    for (let templateIndex = 0; templateIndex < defaultProgramSeed.templates.length; templateIndex += 1) {
      const template = defaultProgramSeed.templates[templateIndex];
      const templateResult = await db.runAsync(
        `INSERT INTO workout_templates (program_id, name, subtitle, duration_minutes, position)
         VALUES (?, ?, ?, ?, ?)`,
        programId,
        template.name,
        template.subtitle,
        template.durationMinutes,
        templateIndex,
      );
      const templateId = Number(templateResult.lastInsertRowId);

      for (let exerciseIndex = 0; exerciseIndex < template.exercises.length; exerciseIndex += 1) {
        const [slug, targetSets, minReps, maxReps, restSeconds] = template.exercises[exerciseIndex];
        const exerciseId = await exerciseIdForSlug(slug);
        await db.runAsync(
          `INSERT INTO workout_template_exercises
             (template_id, exercise_id, position, target_sets, min_reps, max_reps, rest_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          templateId,
          exerciseId,
          exerciseIndex,
          targetSets,
          minReps,
          maxReps,
          restSeconds,
        );
      }
    }
  }

  const weightCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM weight_entries');
  if (!weightCount?.count) {
    const values = [73.8, 73.5, 73.6, 73.2, 73.0, 72.9, 72.8];
    const dates = ['2026-07-13', '2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'];
    for (let i = 0; i < values.length; i += 1) {
      await db.runAsync('INSERT INTO weight_entries (weight_kg, recorded_at) VALUES (?, ?)', values[i], dates[i]);
    }
  }

  const goalCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM goals');
  if (!goalCount?.count) {
    const goals = [
      ['Dumbbell bench × 10', 'strength', 15, 20, 'kg'],
      ['Body weight', 'body', 72.8, 75, 'kg'],
      ['Strict pull-ups', 'strength', 4, 10, 'reps'],
      ['Training consistency', 'consistency', 3, 4, 'sessions/wk'],
      ['Daily steps average', 'steps', 8421, 10000, 'steps'],
    ];
    for (const goal of goals) {
      await db.runAsync(
        'INSERT INTO goals (title, category, current_value, target_value, unit) VALUES (?, ?, ?, ?, ?)',
        goal,
      );
    }
  }
}

export async function getWeights(): Promise<WeightEntry[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ id: number; weight_kg: number; recorded_at: string }>(
    'SELECT * FROM weight_entries ORDER BY recorded_at ASC, id ASC',
  );
  return rows.map((row) => ({ id: row.id, weightKg: row.weight_kg, recordedAt: row.recorded_at }));
}

export async function addWeight(weightKg: number) {
  const db = await database();
  await db.runAsync(
    'INSERT INTO weight_entries (weight_kg, recorded_at) VALUES (?, ?)',
    weightKg,
    new Date().toISOString(),
  );
}

export async function getGoals(): Promise<Goal[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: number;
    title: string;
    category: Goal['category'];
    current_value: number;
    target_value: number;
    unit: string;
    is_completed: number;
  }>('SELECT * FROM goals ORDER BY id ASC');
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    currentValue: row.current_value,
    targetValue: row.target_value,
    unit: row.unit,
    isCompleted: Boolean(row.is_completed),
  }));
}

export async function toggleGoal(id: number, completed: boolean) {
  const db = await database();
  await db.runAsync('UPDATE goals SET is_completed = ? WHERE id = ?', completed ? 1 : 0, id);
}

export async function getActiveProgram(): Promise<Program | null> {
  const db = await database();
  const row = await db.getFirstAsync<{
    id: number;
    name: string;
    goal: string;
    target_sessions_per_week: number;
  }>(
    `SELECT id, name, goal, target_sessions_per_week
     FROM programs
     ORDER BY is_active DESC, id ASC
     LIMIT 1`,
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    targetSessionsPerWeek: row.target_sessions_per_week,
  };
}

export async function updateProgram(programId: number, values: Partial<Pick<Program, 'name' | 'goal' | 'targetSessionsPerWeek'>>) {
  const db = await database();
  const current = await getActiveProgram();
  if (!current || current.id !== programId) return;
  await db.runAsync(
    `UPDATE programs
     SET name = ?, goal = ?, target_sessions_per_week = ?
     WHERE id = ?`,
    values.name ?? current.name,
    values.goal ?? current.goal,
    Math.max(1, Math.min(7, values.targetSessionsPerWeek ?? current.targetSessionsPerWeek)),
    programId,
  );
}

async function getTemplateExercises(templateId: number): Promise<WorkoutTemplateExercise[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    template_exercise_id: number;
    exercise_id: number;
    slug: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
    video_url: string | null;
    technique_notes: string | null;
    position: number;
    target_sets: number;
    min_reps: number;
    max_reps: number;
    rest_seconds: number;
  }>(
    `SELECT wte.id AS template_exercise_id, e.id AS exercise_id, e.slug, e.name,
            e.muscle_group, e.equipment, e.video_url, e.technique_notes,
            wte.position, wte.target_sets, wte.min_reps, wte.max_reps, wte.rest_seconds
     FROM workout_template_exercises wte
     JOIN exercises e ON e.id = wte.exercise_id
     WHERE wte.template_id = ?
     ORDER BY wte.position ASC, wte.id ASC`,
    templateId,
  );
  return rows.map((row) => ({
    templateExerciseId: row.template_exercise_id,
    id: row.exercise_id,
    slug: row.slug,
    name: row.name,
    muscle: row.muscle_group,
    equipment: row.equipment ?? 'Other',
    videoUrl: row.video_url,
    techniqueNotes: row.technique_notes,
    position: row.position,
    targetSets: row.target_sets,
    minReps: row.min_reps,
    maxReps: row.max_reps,
    restSeconds: row.rest_seconds,
  }));
}

export async function getWorkoutTemplates(programId: number): Promise<WorkoutTemplate[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: number;
    program_id: number;
    name: string;
    subtitle: string;
    duration_minutes: number;
    position: number;
  }>(
    `SELECT id, program_id, name, subtitle, duration_minutes, position
     FROM workout_templates
     WHERE program_id = ?
     ORDER BY position ASC, id ASC`,
    programId,
  );
  return Promise.all(rows.map(async (row) => {
    const exercises = await getTemplateExercises(row.id);
    return {
      id: row.id,
      programId: row.program_id,
      name: row.name,
      subtitle: row.subtitle,
      durationMinutes: row.duration_minutes,
      position: row.position,
      exerciseCount: exercises.length,
      workingSets: exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0),
      exercises,
    };
  }));
}

export async function getWorkoutTemplate(templateId: number): Promise<WorkoutTemplate | null> {
  const db = await database();
  const row = await db.getFirstAsync<{
    id: number;
    program_id: number;
    name: string;
    subtitle: string;
    duration_minutes: number;
    position: number;
  }>(
    `SELECT id, program_id, name, subtitle, duration_minutes, position
     FROM workout_templates
     WHERE id = ?`,
    templateId,
  );
  if (!row) return null;
  const exercises = await getTemplateExercises(row.id);
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    subtitle: row.subtitle,
    durationMinutes: row.duration_minutes,
    position: row.position,
    exerciseCount: exercises.length,
    workingSets: exercises.reduce((sum, exercise) => sum + exercise.targetSets, 0),
    exercises,
  };
}

export async function createWorkoutTemplate(programId: number, name: string, subtitle = 'Custom session') {
  const db = await database();
  const last = await db.getFirstAsync<{ position: number }>(
    'SELECT position FROM workout_templates WHERE program_id = ? ORDER BY position DESC LIMIT 1',
    programId,
  );
  const result = await db.runAsync(
    `INSERT INTO workout_templates (program_id, name, subtitle, duration_minutes, position)
     VALUES (?, ?, ?, 50, ?)`,
    programId,
    name.trim() || 'New Workout',
    subtitle.trim() || 'Custom session',
    (last?.position ?? -1) + 1,
  );
  return Number(result.lastInsertRowId);
}

export async function updateWorkoutTemplate(
  templateId: number,
  values: { name: string; subtitle: string; durationMinutes: number },
) {
  const db = await database();
  await db.runAsync(
    `UPDATE workout_templates
     SET name = ?, subtitle = ?, duration_minutes = ?
     WHERE id = ?`,
    values.name.trim() || 'Workout',
    values.subtitle.trim(),
    Math.max(15, Math.min(180, values.durationMinutes)),
    templateId,
  );
}

export async function deleteWorkoutTemplate(templateId: number) {
  const db = await database();
  await db.runAsync('UPDATE workouts SET template_id = NULL WHERE template_id = ?', templateId);
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', templateId);
}

export async function getExerciseLibrary(): Promise<ExerciseLibraryItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: number;
    slug: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
    video_url: string | null;
    technique_notes: string | null;
  }>('SELECT id, slug, name, muscle_group, equipment, video_url, technique_notes FROM exercises ORDER BY muscle_group, name');
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    muscle: row.muscle_group,
    equipment: row.equipment ?? 'Other',
    videoUrl: row.video_url,
    techniqueNotes: row.technique_notes,
  }));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function createCustomExercise(values: {
  name: string;
  muscle: string;
  equipment: string;
  videoUrl?: string;
  techniqueNotes?: string;
}) {
  const db = await database();
  const baseSlug = slugify(values.name) || 'exercise';
  let slug = baseSlug;
  let suffix = 2;
  while (await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE slug = ?', slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  const result = await db.runAsync(
    `INSERT INTO exercises (slug, name, muscle_group, equipment, video_url, technique_notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    slug,
    values.name.trim() || 'Custom Exercise',
    values.muscle.trim() || 'Other',
    values.equipment.trim() || 'Other',
    values.videoUrl?.trim() || null,
    values.techniqueNotes?.trim() || null,
  );
  return Number(result.lastInsertRowId);
}

export async function addExerciseToTemplate(templateId: number, exerciseId: number) {
  const db = await database();
  const last = await db.getFirstAsync<{ position: number }>(
    'SELECT position FROM workout_template_exercises WHERE template_id = ? ORDER BY position DESC LIMIT 1',
    templateId,
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO workout_template_exercises
       (template_id, exercise_id, position, target_sets, min_reps, max_reps, rest_seconds)
     VALUES (?, ?, ?, 3, 8, 12, 90)`,
    templateId,
    exerciseId,
    (last?.position ?? -1) + 1,
  );
}

export async function removeExerciseFromTemplate(templateExerciseId: number) {
  const db = await database();
  await db.runAsync('DELETE FROM workout_template_exercises WHERE id = ?', templateExerciseId);
}

export async function updateTemplateExercisePrescription(
  templateExerciseId: number,
  values: { targetSets: number; minReps: number; maxReps: number; restSeconds: number },
) {
  const db = await database();
  const minReps = Math.max(1, Math.min(50, values.minReps));
  const maxReps = Math.max(minReps, Math.min(50, values.maxReps));
  await db.runAsync(
    `UPDATE workout_template_exercises
     SET target_sets = ?, min_reps = ?, max_reps = ?, rest_seconds = ?
     WHERE id = ?`,
    Math.max(1, Math.min(10, values.targetSets)),
    minReps,
    maxReps,
    Math.max(30, Math.min(300, values.restSeconds)),
    templateExerciseId,
  );
}

export async function getRecommendedWorkoutTemplate(): Promise<WorkoutTemplate | null> {
  const active = await getActiveWorkout();
  if (active?.templateId) return getWorkoutTemplate(active.templateId);

  const program = await getActiveProgram();
  if (!program) return null;
  const templates = await getWorkoutTemplates(program.id);
  if (!templates.length) return null;

  const db = await database();
  const last = await db.getFirstAsync<{ template_id: number }>(
    `SELECT template_id
     FROM workouts
     WHERE completed_at IS NOT NULL AND template_id IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT 1`,
  );
  if (!last) return templates[0];
  const index = templates.findIndex((template) => template.id === last.template_id);
  return templates[(index + 1 + templates.length) % templates.length] ?? templates[0];
}

export async function getNextWorkoutTemplate(templateId: number): Promise<WorkoutTemplate | null> {
  const current = await getWorkoutTemplate(templateId);
  if (!current) return null;
  const templates = await getWorkoutTemplates(current.programId);
  if (!templates.length) return null;
  const index = templates.findIndex((template) => template.id === templateId);
  return templates[(index + 1 + templates.length) % templates.length] ?? null;
}

export async function getActiveWorkout(): Promise<WorkoutSession | null> {
  const db = await database();
  const row = await db.getFirstAsync<{
    id: number;
    name: string;
    started_at: string;
    completed_at: string | null;
    template_id: number | null;
  }>(`SELECT id, name, started_at, completed_at, template_id
      FROM workouts
      WHERE completed_at IS NULL AND started_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 1`);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    templateId: row.template_id,
  };
}

export async function startWorkout(name: string, templateId: number | null = null): Promise<WorkoutSession> {
  const existing = await getActiveWorkout();
  if (existing) {
    if (!existing.templateId && templateId) {
      const db = await database();
      await db.runAsync('UPDATE workouts SET template_id = ?, name = ? WHERE id = ?', templateId, name, existing.id);
      return { ...existing, name, templateId };
    }
    return existing;
  }

  const db = await database();
  const startedAt = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO workouts (name, started_at, template_id) VALUES (?, ?, ?)',
    name,
    startedAt,
    templateId,
  );
  return {
    id: Number(result.lastInsertRowId),
    name,
    startedAt,
    completedAt: null,
    templateId,
  };
}

export async function finishWorkout(workoutId: number) {
  const db = await database();
  await db.runAsync(
    'UPDATE workouts SET completed_at = ? WHERE id = ?',
    new Date().toISOString(),
    workoutId,
  );
}

async function exerciseIdForSlug(slug: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE slug = ?', slug);
  if (!row) throw new Error(`Unknown exercise: ${slug}`);
  return row.id;
}

export async function getExerciseDetail(exerciseSlug: string, templateId: number | null): Promise<WorkoutTemplateExercise | null> {
  const db = await database();
  if (templateId) {
    const row = await db.getFirstAsync<{
      template_exercise_id: number;
      exercise_id: number;
      slug: string;
      name: string;
      muscle_group: string;
      equipment: string | null;
      video_url: string | null;
      technique_notes: string | null;
      position: number;
      target_sets: number;
      min_reps: number;
      max_reps: number;
      rest_seconds: number;
    }>(
      `SELECT wte.id AS template_exercise_id, e.id AS exercise_id, e.slug, e.name,
              e.muscle_group, e.equipment, e.video_url, e.technique_notes,
              wte.position, wte.target_sets, wte.min_reps, wte.max_reps, wte.rest_seconds
       FROM workout_template_exercises wte
       JOIN exercises e ON e.id = wte.exercise_id
       WHERE wte.template_id = ? AND e.slug = ?`,
      templateId,
      exerciseSlug,
    );
    if (row) {
      return {
        templateExerciseId: row.template_exercise_id,
        id: row.exercise_id,
        slug: row.slug,
        name: row.name,
        muscle: row.muscle_group,
        equipment: row.equipment ?? 'Other',
        videoUrl: row.video_url,
        techniqueNotes: row.technique_notes,
        position: row.position,
        targetSets: row.target_sets,
        minReps: row.min_reps,
        maxReps: row.max_reps,
        restSeconds: row.rest_seconds,
      };
    }
  }

  const row = await db.getFirstAsync<{
    id: number;
    slug: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
    video_url: string | null;
    technique_notes: string | null;
  }>(
    'SELECT id, slug, name, muscle_group, equipment, video_url, technique_notes FROM exercises WHERE slug = ?',
    exerciseSlug,
  );
  if (!row) return null;
  return {
    templateExerciseId: 0,
    id: row.id,
    slug: row.slug,
    name: row.name,
    muscle: row.muscle_group,
    equipment: row.equipment ?? 'Other',
    videoUrl: row.video_url,
    techniqueNotes: row.technique_notes,
    position: 0,
    targetSets: 3,
    minReps: 8,
    maxReps: 12,
    restSeconds: 90,
  };
}

export async function getPreviousExerciseSets(exerciseSlug: string, currentWorkoutId: number): Promise<Array<{ weightKg: number | null; reps: number | null }>> {
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const previousWorkout = await db.getFirstAsync<{ id: number }>(
    `SELECT w.id
     FROM workouts w
     JOIN workout_sets ws ON ws.workout_id = w.id
     WHERE ws.exercise_id = ? AND ws.completed = 1 AND w.id != ? AND w.completed_at IS NOT NULL
     ORDER BY w.completed_at DESC
     LIMIT 1`,
    exerciseId,
    currentWorkoutId,
  );
  if (!previousWorkout) return [];
  const rows = await db.getAllAsync<{ weight_kg: number | null; reps: number | null }>(
    `SELECT weight_kg, reps
     FROM workout_sets
     WHERE workout_id = ? AND exercise_id = ? AND completed = 1
     ORDER BY set_number ASC`,
    previousWorkout.id,
    exerciseId,
  );
  return rows.map((row) => ({ weightKg: row.weight_kg, reps: row.reps }));
}

export async function getWorkoutSets(workoutId: number, exerciseSlug: string): Promise<WorkoutSet[]> {
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const rows = await db.getAllAsync<{
    id: number;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    completed: number;
  }>(
    `SELECT id, set_number, weight_kg, reps, completed
     FROM workout_sets
     WHERE workout_id = ? AND exercise_id = ?
     ORDER BY set_number ASC`,
    workoutId,
    exerciseId,
  );
  return rows.map((row) => ({
    id: row.id,
    workoutId,
    exerciseSlug,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    completed: Boolean(row.completed),
  }));
}

export async function saveWorkoutSet(set: WorkoutSet): Promise<PersonalBest['metric'][]> {
  const db = await database();
  const exerciseId = await exerciseIdForSlug(set.exerciseSlug);
  await db.runAsync(
    `INSERT INTO workout_sets (workout_id, exercise_id, set_number, weight_kg, reps, completed)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(workout_id, exercise_id, set_number)
     DO UPDATE SET weight_kg = excluded.weight_kg, reps = excluded.reps, completed = excluded.completed`,
    set.workoutId,
    exerciseId,
    set.setNumber,
    set.weightKg,
    set.reps,
    set.completed ? 1 : 0,
  );

  if (!set.completed || !set.weightKg || !set.reps) return [];

  const metrics: Array<[PersonalBest['metric'], number]> = [
    ['weight', set.weightKg],
    ['reps', set.reps],
    ['e1rm', set.weightKg * (1 + set.reps / 30)],
    ['volume', set.weightKg * set.reps],
  ];
  const achieved: PersonalBest['metric'][] = [];
  const achievedAt = new Date().toISOString();

  for (const [metric, value] of metrics) {
    const current = await db.getFirstAsync<{ value: number }>(
      `SELECT value FROM personal_bests
       WHERE exercise_id = ? AND metric = ?
       ORDER BY value DESC
       LIMIT 1`,
      exerciseId,
      metric,
    );
    if (!current || value > current.value) {
      await db.runAsync(
        'INSERT INTO personal_bests (exercise_id, metric, value, achieved_at) VALUES (?, ?, ?, ?)',
        exerciseId,
        metric,
        value,
        achievedAt,
      );
      achieved.push(metric);
    }
  }
  return achieved;
}

export async function getPersonalBests(exerciseSlug: string): Promise<PersonalBest[]> {
  const db = await database();
  const exerciseId = await exerciseIdForSlug(exerciseSlug);
  const rows = await db.getAllAsync<{
    metric: PersonalBest['metric'];
    value: number;
    achieved_at: string;
  }>(
    `SELECT pb.metric, pb.value, pb.achieved_at
     FROM personal_bests pb
     INNER JOIN (
       SELECT metric, MAX(value) AS max_value
       FROM personal_bests
       WHERE exercise_id = ?
       GROUP BY metric
     ) best ON best.metric = pb.metric AND best.max_value = pb.value
     WHERE pb.exercise_id = ?
     GROUP BY pb.metric
     ORDER BY pb.metric ASC`,
    exerciseId,
    exerciseId,
  );
  return rows.map((row) => ({ metric: row.metric, value: row.value, achievedAt: row.achieved_at }));
}

export async function getPersonalBestHistory(limit = 50): Promise<PersonalBestHistoryItem[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: number;
    slug: string;
    name: string;
    metric: PersonalBest['metric'];
    value: number;
    achieved_at: string;
  }>(
    `SELECT pb.id, e.slug, e.name, pb.metric, pb.value, pb.achieved_at
     FROM personal_bests pb
     JOIN exercises e ON e.id = pb.exercise_id
     ORDER BY pb.achieved_at DESC, pb.id DESC
     LIMIT ?`,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    exerciseSlug: row.slug,
    exerciseName: row.name,
    metric: row.metric,
    value: row.value,
    achievedAt: row.achieved_at,
  }));
}

export async function getStrengthTrends(limit = 3): Promise<StrengthTrend[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    slug: string;
    name: string;
    weight_kg: number;
    completed_at: string;
  }>(
    `SELECT e.slug, e.name, ws.weight_kg, COALESCE(w.completed_at, w.started_at) AS completed_at
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.completed = 1 AND ws.weight_kg IS NOT NULL
     ORDER BY completed_at ASC, ws.id ASC`,
  );

  const grouped = new Map<string, { name: string; values: number[] }>();
  for (const row of rows) {
    const item = grouped.get(row.slug) ?? { name: row.name, values: [] };
    item.values.push(row.weight_kg);
    grouped.set(row.slug, item);
  }

  return Array.from(grouped.entries())
    .filter(([, item]) => item.values.length > 0)
    .map(([exerciseSlug, item]) => {
      const fromKg = item.values[0];
      const currentKg = Math.max(...item.values);
      return {
        exerciseSlug,
        exerciseName: item.name,
        fromKg,
        currentKg,
        changePct: fromKg > 0 ? ((currentKg - fromKg) / fromKg) * 100 : 0,
      };
    })
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, limit);
}

export async function getCompletedWorkoutCountSince(sinceIso: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM workouts WHERE completed_at IS NOT NULL AND completed_at >= ?',
    sinceIso,
  );
  return row?.count ?? 0;
}

export async function getWorkoutHistory(limit = 10): Promise<WorkoutSession[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    started_at: string;
    completed_at: string | null;
    template_id: number | null;
  }>(
    `SELECT id, name, started_at, completed_at, template_id
     FROM workouts
     WHERE started_at IS NOT NULL
     ORDER BY started_at DESC
     LIMIT ?`,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    templateId: row.template_id,
  }));
}
