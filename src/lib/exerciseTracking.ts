import type { ExerciseLibraryItem } from './types';

export type ExerciseTrackingMode = 'weighted-reps' | 'bodyweight-reps' | 'timed-bodyweight' | 'cardio';

type TrackableExercise = Pick<ExerciseLibraryItem, 'name' | 'muscle' | 'equipment'>;

const cardioPattern = /\b(rowing|rower|treadmill|stationary bike|exercise bike|spin bike|cycling|cycle|elliptical|cross trainer|stair climber|stairmaster|stepper|ski erg|skierg)\b/i;
const timedBodyweightPattern = /\b(plank|hold|dead hang|hang|wall sit|hollow hold|isometric)\b/i;

export function getExerciseTrackingMode(exercise: TrackableExercise): ExerciseTrackingMode {
  const descriptor = `${exercise.name} ${exercise.muscle} ${exercise.equipment}`;
  const muscle = exercise.muscle.toLowerCase();
  const equipment = exercise.equipment.toLowerCase();
  const bodyweight = equipment.includes('bodyweight') || equipment.includes('body weight');

  if (muscle.includes('cardio') || cardioPattern.test(descriptor)) return 'cardio';
  if (bodyweight && timedBodyweightPattern.test(exercise.name)) return 'timed-bodyweight';
  if (bodyweight) return 'bodyweight-reps';
  return 'weighted-reps';
}

export function isTimedTrackingMode(mode: ExerciseTrackingMode) {
  return mode === 'cardio' || mode === 'timed-bodyweight';
}
