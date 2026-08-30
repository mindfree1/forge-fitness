import { database } from './db';

export async function updateExerciseMedia(
  exerciseId: number,
  values: { videoUrl: string; techniqueNotes: string },
) {
  const db = await database();
  await db.runAsync(
    `UPDATE exercises
     SET video_url = ?, technique_notes = ?
     WHERE id = ?`,
    values.videoUrl.trim() || null,
    values.techniqueNotes.trim() || null,
    exerciseId,
  );
}
