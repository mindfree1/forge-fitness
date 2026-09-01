# Forge Gym Flow v4.2

## Status
Draft implementation for physical-device gym QA. V4.2 is stacked on `feature/goals-v4.1` and should remain unmerged until a second real training session validates the flow.

## Product goal
Make Forge behave like a real gym session rather than a fixed checklist. The app should keep time and data quietly while letting the user train around busy equipment, cardio warm-ups, changed rep targets and fatigue.

## Included

### Session lifecycle
- one explicit `Start session` action
- persistent elapsed session timer derived from the stored workout `started_at` timestamp
- no pause button
- backgrounding, switching apps or reopening Forge does not lose elapsed time
- active sessions show `Finish session`, not `Resume session`
- finish summary shows duration, completed exercises, completed working sets and PB count
- local, original completion encouragement plus next rotation session

### Flexible exercise order
- active-session exercise order is persisted separately from the permanent workout template
- exercises can be moved up/down while training when equipment is busy
- changing active order does not rewrite the user's permanent program
- an exercise can be added to the current session only from the exercise library

### Completion state
- strength and bodyweight-rep exercises show completed-set count in the active workout list
- prescribed-set completion gives a clear green completed state
- completing the final prescribed rep-based set gives a short completion confirmation and returns to the workout
- timed cardio / timed-hold completion also appears as completed in the workout list

### Strength set usability
- KG and REPS hit areas are larger and visually explicit for weighted exercises
- numeric inputs retain their existing decimal/integer keyboards
- added extra sets can be deleted when the user changes their mind before completion
- one-arm / single-arm weighted exercise names display `KG/ARM` and clarify that load is entered per working arm
- a set cannot be ticked complete until the required values have been entered

### Bodyweight logging
- bodyweight rep exercises such as Pull-Up, Push-Up and Sit-Up use REPS + sets with no meaningless KG field
- rep-only sets can establish rep PBs
- previous bodyweight sets display previous reps rather than `—`
- Plank and other obvious bodyweight holds use a simple timestamp-backed hold timer rather than KG/REPS
- weighted/assisted bodyweight progression is deliberately not added to this patch; a later training-guidance pass can introduce explicit added-load/assistance semantics without changing today's simple bodyweight flow

### Quiet set timing foundation
- Forge records an `intent_started_at` timestamp once the required set target is entered
- for weighted sets that means load + reps; for bodyweight rep sets that means reps
- Forge records a separate set completion timestamp when the tick is pressed
- editing a planned target does not restart the intent timestamp
- no extra visible set stopwatch is added in V4.2
- future analysis can discard implausibly short/long inferred timings rather than pretending all timings are exact

### Cardio / warm-up logging
- cardio is classified by Cardio category plus common equipment/activity names, so it is not rowing-specific
- Rowing Machine, Treadmill, Stationary Bike, Elliptical and Stair Climber are included in the standard exercise library
- timed cardio uses one-tap start/stop with timestamp-derived elapsed time instead of KG + REPS
- optional distance entry in kilometres
- cardio survives app backgrounding/reopening because elapsed time derives from timestamps
- cardio can be added to the current session without permanently changing the rotation
- the data shape remains intentionally small in V4.2; later optional fields can include kcal estimate, heart rate, incline, resistance, watts, cadence, pace or rowing stroke rate without crowding today's workout screen

## Explicitly not V4.2
- RIR / Easy-Good-Hard-Max capture (V5)
- progressive-overload recommendations (V5)
- AI machine photo identification
- automatic machine-console OCR
- global kg/lb conversion system
- weighted/assisted pull-up progression semantics
- guided onboarding tour
- streaks or missed-day penalties

## Session 2 QA
1. Start session and confirm timer begins once and continues accurately.
2. Background Forge for several minutes and confirm session time remains correct.
3. Add Rowing Machine, Treadmill or Stationary Bike to the active session only; verify it does not require KG/REPS.
4. Start/stop cardio and enter distance; verify duration/distance remain after navigating away/back.
5. Add or open Pull-Up / Sit-Up / Push-Up and confirm the set UI asks for reps only.
6. Complete a bodyweight set and confirm the rep result persists and a rep PB can be established.
7. Open Plank and confirm it uses a timed hold instead of KG/REPS.
8. Reorder two exercises because of equipment availability; verify the active order changes and survives navigation.
9. Log a normal weighted exercise and verify completed-set count updates on Train.
10. Complete the final prescribed set; verify completion confirmation and return to the workout list.
11. Add an extra set, then delete it before completion.
12. Test a one-arm weighted exercise and confirm KG/ARM wording is clear.
13. Enter load/reps quickly and confirm the first digit is not dropped.
14. Finish the session and verify the completion summary duration, exercises and sets are sensible.
15. Reopen Train and confirm Forge has advanced to the next rotation session without missed-day/streak language.
16. Confirm Progress still reads only real completed training data.
