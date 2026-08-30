# Forge Fitness

A private, Android-first fitness tracker built for personal use: workouts, strength progression, body weight, goals, PBs, and eventually Health Connect steps.

## MVP status

The first product slice includes:

- **Today** — dashboard, weight logging, weekly consistency, today's workout, latest PB
- **Train** — structured Push Strength workout with previous-set context
- **Exercise detail** — editable kg/reps, set completion, add-set interaction, technique placeholder
- **Progress** — persisted weight trend, strength progress, PB summary
- **Goals** — persisted benchmark list and completion state
- **Local persistence** — SQLite schema for weights, goals, workouts, sets, exercises and PBs

The app ships with seed data so the first-run UI is useful immediately. The step count shown in this first slice is explicitly preview data; Android Health Connect will replace it in the next implementation pass.

## Product principles

1. Fitness first; mental-health and nutrition features stay out of the MVP.
2. No account, subscription, analytics SDK, or remote backend required.
3. Personal data stays on-device by default.
4. One-handed workout logging and obvious previous-set context.
5. Premium visual quality despite being a private app.

## Stack

- Expo SDK 57 / React Native 0.86
- TypeScript
- Expo Router
- Expo SQLite
- Material Community Icons
- Expo Haptics

## Run locally

Requires Node.js 22.13+ for Expo SDK 57.

```bash
npm install
npm run start
```

For Android:

```bash
npm run android
```

## Planned next slice

- Android Health Connect step ingestion
- Real workout-session persistence and workout history
- Automatic PB detection (weight, reps, estimated 1RM, volume)
- Rest timer
- Workout templates / Push-Pull-Legs editing
- Exercise technique videos via embeddable public sources
- Export/import local backup

## Data model

SQLite currently creates:

- `weight_entries`
- `goals`
- `workouts`
- `exercises`
- `workout_sets`
- `personal_bests`

This keeps the app local-first while leaving room for future Health Connect, nutrition and optional backup integrations.
