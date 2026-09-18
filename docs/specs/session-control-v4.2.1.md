# Forge Session Control v4.2.1

## Status
Draft implementation for a third physical-device QA pass. V4.2.1 is stacked directly on `feature/gym-flow-v4.2`.

## Why this patch exists
Session 2 exposed four concrete gym-flow problems: a forgotten session could keep running for days, workout order controls were too clumsy, recorded sets/sessions were hard to remove, and the recommended rotation was too rigid when the user wanted a different workout today.

## Included

### Stale-session recovery
- active sessions older than six hours are treated as unfinished sessions that need review rather than valid marathon workouts
- the Train screen suppresses the absurd elapsed timer and opens a recovery sheet
- **Fix using logged activity** uses the first and last reliable set/cardio completion timestamps to repair the workout start/end time
- **Continue this session** keeps the workout open deliberately
- **Delete session** removes the workout and its logged data
- completing every exercise prompts **Finished for today?** with Finish or Keep training rather than silently ending the session

### Session choice before the timer starts
- the recommended rotation remains the default, not a rule
- before Start session, **Change** lets the user pick any existing workout template
- **Quick session / Custom today** starts an empty session and opens the existing exercise picker
- choosing another workout for today does not rewrite the permanent program or rotation order

### Drag reorder
- active exercises use a drag handle rather than up/down arrow buttons
- dragging vertically moves an exercise to the dropped position
- the resulting order is persisted only for the active workout

### Deletion and correction
- Session history lists completed and unfinished workouts with a delete action
- deleting a session cascades its workout data and rebuilds PB history from the remaining valid completed sets
- any set can be deleted with a long press, including a completed set
- deleting a prescribed set clears that slot; deleting an extra set removes the row
- PB history is rebuilt after set deletion so removed records do not leave ghost PBs

### Progress / motivation polish
- the Today consistency card uses a neutral calendar/check icon rather than a streak-style fire
- PB History groups multiple same-day records for the same exercise into one achievement card instead of flooding the timeline with separate LOAD / REPS / e1RM / VOLUME cards
- bodyweight rep PBs are supported when no external load is present

## Deliberately not included
- V5 RIR / Easy-Good-Hard-Max guidance
- overload recommendations
- scheduled push notifications when the user leaves the gym
- cloud sync/accounts
- weighted-vs-assisted pull-up semantics
- AI equipment recognition

## QA gate
1. Open an old unfinished workout and confirm Forge shows **Needs review**, not a hundreds-of-hours timer.
2. Use **Fix using logged activity** on a stale workout with reliable set timestamps; verify the repaired duration is sensible and the workout becomes completed.
3. Start another session, complete every planned exercise, and verify Forge asks whether the workout is finished rather than auto-ending it.
4. On a fresh pre-session Train screen, tap **Change** and select a different template; verify the permanent rotation is unchanged.
5. Start **Quick session / Custom today**, add only one or two exercises, and train normally.
6. Drag an exercise from one position to another and verify its active-session order persists after navigating away/back.
7. Long-press a completed set, delete it, reopen the exercise, and verify the set is gone and PBs are recalculated if needed.
8. Open Session history and delete a completed test session; confirm Progress/PBs no longer include its data.
9. Verify PB History groups multiple records for one exercise/day into one card.
10. Verify Today no longer uses a fire/streak icon.
11. Verify TypeScript and Android export pass.
