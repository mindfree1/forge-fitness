export type WeightEntry = {
  id: number;
  weightKg: number;
  recordedAt: string;
};

export type Goal = {
  id: number;
  title: string;
  category: 'strength' | 'body' | 'consistency' | 'steps';
  currentValue: number;
  targetValue: number;
  unit: string;
  isCompleted: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  target: string;
  previous: string[];
};

export type ExerciseLibraryItem = {
  id: number;
  slug: string;
  name: string;
  muscle: string;
  equipment: string;
  videoUrl: string | null;
  techniqueNotes: string | null;
};

export type Program = {
  id: number;
  name: string;
  goal: string;
  targetSessionsPerWeek: number;
};

export type WorkoutTemplateExercise = ExerciseLibraryItem & {
  templateExerciseId: number;
  position: number;
  targetSets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
};

export type WorkoutTemplate = {
  id: number;
  programId: number;
  name: string;
  subtitle: string;
  durationMinutes: number;
  position: number;
  exerciseCount: number;
  workingSets: number;
  exercises: WorkoutTemplateExercise[];
};

export type WorkoutSession = {
  id: number;
  name: string;
  startedAt: string;
  completedAt: string | null;
  templateId: number | null;
};

export type WorkoutSet = {
  id?: number;
  workoutId: number;
  exerciseSlug: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
};

export type PersonalBest = {
  metric: 'weight' | 'reps' | 'e1rm' | 'volume';
  value: number;
  achievedAt: string;
};

export type PersonalBestHistoryItem = PersonalBest & {
  id: number;
  exerciseSlug: string;
  exerciseName: string;
};

export type StrengthTrend = {
  exerciseSlug: string;
  exerciseName: string;
  fromKg: number;
  currentKg: number;
  changePct: number;
};
