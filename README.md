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
- Expo Development Client / EAS Build for Android testing

## Test on a physical Android device

Forge does not need Vercel or the Google Play Store. The recommended workflow is an Expo development build installed directly on the Android device.

### First-time computer setup

```bash
git clone https://github.com/mindfree1/forge-fitness.git
cd forge-fitness
git checkout feature/training-core-v2
npm install
npm install --global eas-cli
eas login
```

On the first EAS build, Expo may ask to create/link an EAS project and generate Android signing credentials. Accept the managed defaults for this personal app.

### Development APK — recommended while building

```bash
eas build --platform android --profile development
```

Open the build URL on the Android device and install the generated APK. Android may ask you to allow installs from the browser or Files app used to open the APK.

After Forge is installed, start the development server on the computer:

```bash
npm run dev
```

Open Forge from the Android home screen and connect to the development server. The phone and computer can use the same Wi-Fi network. If local-network discovery is troublesome, run:

```bash
npx expo start --dev-client --tunnel
```

JavaScript/TypeScript changes normally appear without rebuilding the APK. Rebuild the development client when adding or changing native libraries/configuration, including Health Connect integration.

### Standalone preview APK — use without a computer

```bash
eas build --platform android --profile preview
```

Install the resulting APK from the Expo build link. This build contains the JavaScript bundle and can be used normally without Metro or a development computer running.

### Optional local USB workflow

With Android Studio/Android SDK and USB debugging configured, Forge can also be compiled and installed directly from the computer:

```bash
npx expo run:android
```

For this project, EAS development + preview APKs are the recommended default because they require less Android build-tool maintenance.

## Build profiles

`eas.json` contains:

- `development` — installable APK with Expo Dev Client and debugging tools
- `preview` — installable standalone APK for real-world testing
- `production` — reserved for a future store-style build if ever needed

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
