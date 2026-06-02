# Apple Watch Wireframes (Draft)

Goal: minimize taps and cognitive load during live refereeing.

Assumptions:
- Most actions happen while attention is on the match, not the screen.
- Score updates and pause/resume must be near-instant.
- Accidental taps must be recoverable quickly.

## Design A: Single-Screen Quick Control

Best for: fastest interaction, minimal navigation.

### A1) Live Match Screen

```text
┌──────────────────────────┐
│ P2 08:14         RUNNING │
│                          │
│        HOME  2 - 1 AWAY  │
│                          │
│   [ +HOME ]    [ +AWAY ] │
│                          │
│ [ PAUSE ]       [ MORE ] │
└──────────────────────────┘
```

Interaction notes:
- Primary actions are always visible.
- Long-press `+HOME`/`+AWAY` opens quick correction menu (`-1`, `+2`, `manual`).
- `MORE` opens secondary actions (period end, format edit, undo).

### A2) Pause State

```text
┌──────────────────────────┐
│ P2 08:14          PAUSED │
│                          │
│        HOME  2 - 1 AWAY  │
│                          │
│ [ RESUME ]     [ END P ] │
│                          │
│ [ CORRECT ]    [ MORE ]  │
└──────────────────────────┘
```

## Design B: Swipe Tabs (Time / Score / Admin)

Best for: clearer separation, fewer accidental admin actions.

### B1) Tab 1: Time

```text
┌──────────────────────────┐
│ TIME                     │
│                          │
│      HOME 2     1 AWAY   │
│     [tap]       [tap]    │
│                          │
│          08:14           │
│             P2           │
│                          │
│ [ PAUSE ]     [ END P ]  │
└──────────────────────────┘
```

Interaction notes:
- Tapping `HOME` score increments home by `+1`.
- Tapping `AWAY` score increments away by `+1`.
- Swipe to `B2` for corrections and explicit `+/-` controls.
- Timer shows period time as countdown (remaining time).
- If period time passes `00:00`, display overtime as `+MM:SS over`.
- `End Period` must work even when timer was not started.
- `End Match` action must be available in-match.

### B2) Tab 2: Score

```text
┌──────────────────────────┐
│ SCORE                    │
│                          │
│        HOME  2 - 1 AWAY  │
│                          │
│   [ +HOME ]    [ +AWAY ] │
│ [ -HOME ]      [ -AWAY ] │
└──────────────────────────┘
```

### B3) Tab 3: Admin

```text
┌──────────────────────────┐
│ ADMIN                    │
│                          │
│ [ FORMAT ]   [ EVENTS ]  │
│ [ SHARE ]    [ SETTINGS ]│
│                          │
│ [ END MATCH ]            │
└──────────────────────────┘
```

Interaction notes:
- Digital Crown or horizontal swipe switches tabs.
- Critical controls (time + score) are split to reduce mis-taps.

## Design C: Radial Quick Actions + Confirmation Sheet

Best for: fast power-user operation with fewer on-screen buttons.

### C1) Compact Live View

```text
┌──────────────────────────┐
│ P2 08:14         RUNNING │
│        HOME  2 - 1 AWAY  │
│                          │
│        [ HOLD ACTION ]   │
│                          │
│        Last: +HOME       │
└──────────────────────────┘
```

### C2) Action Wheel (on hold)

```text
┌──────────────────────────┐
│         (+HOME)          │
│      (+AWAY) (PAUSE)     │
│                          │
│      (-HOME) (-AWAY)     │
│        (END P)           │
└──────────────────────────┘
```

Interaction notes:
- Hold then flick gesture picks an action quickly.
- Optional confirmation only for destructive actions (`END P`, `END MATCH`).

## Design D: Referee Pair Mode (Creator + Joiners)

Best for: collaboration with RO/RW permissions.

### D1) Session Join

```text
┌──────────────────────────┐
│ JOIN MATCH               │
│                          │
│ [ Nearby Matches ]       │
│ [ Enter Code ]           │
│ [ QR from Phone ]        │
│                          │
│ Role after join: RO      │
└──────────────────────────┘
```

### D2) Member Role View (RW only)

```text
┌──────────────────────────┐
│ MATCH MEMBERS            │
│                          │
│ Alex (RW)                │
│ Sam  (RO) [Promote]      │
│ Jo   (RO) [Promote]      │
│                          │
│ [ Invite ]               │
└──────────────────────────┘
```

## Recommended MVP Direction

Use Design B as baseline, with selective additions:
- Base layout from Design B tabbed flow (`B1` for timer + quick score taps).
- Keep advanced score control in `B2`.
- Add Design D join flow for collaboration.

## Manual Watch App Reference Design

Use the manually created watch app at
`/Users/thomas/Documents/XCode Projects/Hockey` as visual reference only.
Do not edit that project. Port layout and interaction ideas into this repo on
top of the event-sourced match model.

### Reference Tab Flow

```text
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Game Type   │  │ Game        │  │ Timer       │  │ Edit Score  │
│             │  │             │  │             │  │             │
│ format grid │  │ match ctrl  │  │ live face   │  │ corrections │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

For current implementation, defer `Game Type` until format-change events and
parity flows exist. Keep its look documented as future reference:

```text
┌──────────────────────────┐
│ [ 2 x 20 ] [ 2 x 25 ]    │
│ [ 2 x 30 ] [ 2 x 35 ]    │
│ [ 4 x 17.5 ]             │
└──────────────────────────┘
```

### Reference Game Control Screen

```text
┌──────────────────────────┐
│ [ + ] Match   [ x ] Qtr  │
│                          │
│        [ ▶ ] Start       │
│                          │
│ or while running:        │
│        [ ❚❚ ] Pause      │
└──────────────────────────┘
```

Behavior to carry forward:
- Use compact icon buttons for match reset/new match, period end, start, and
  pause.
- Disable actions that do not apply to current match state.
- Starting a period can move the user directly to the live timer face.
- Admin/game controls must sit in a vertical scroll container. Smaller watch
  sizes can clip the API/settings controls if this screen uses a fixed stack.

### Reference Timer Screen

```text
┌──────────────────────────┐
│    [ home score ] - [ away score ] │
│                          │
│          08:14           │
│             2/4          │
│                          │
│      [ Start 3rd Period ]│
└──────────────────────────┘
```

Behavior to carry forward:
- Home and away scores are large tap targets at the top.
- Timer is the primary element, very large, rounded, monospaced digits.
- Remaining time uses yellow while positive and red once overtime starts.
- Period indicator uses current period and total period count.
- Between periods, replace the live timer with a start-next-period action.
- After final period, offer new match/reset flow.

### Ended Match Quick Restart

When a watch match is ended, the next action should be starting a fresh match,
not digging through settings. The ended timer screen should show:

```text
┌──────────────────────────┐
│          ENDED           │
│                          │
│      [ 4 x 17½ ]         │
│        New Match         │
│                          │
│      [ Other Format ]    │
└──────────────────────────┘
```

Behavior:
- `4 x 17½` is the prominent one-tap target.
- Tapping it creates a new quick watch match, applies format `4 x 17.5`, and
  leaves the clock paused at `1/4` ready for `Start`.
- `Other Format` opens compact choices: `2 x 20`, `2 x 25`, `2 x 30`,
  `2 x 35`, and `4 x 17½`.
- New match creation must use a new `matchId`. Reusing an ended match id is
  invalid because replay keeps ended matches ended.
- The watch persists the selected quick match id locally so polling and queued
  events continue against the active match.

### Reference Score Edit Screen

```text
┌──────────────────────────┐
│      [ ▲ ]       [ ▲ ]   │
│        2    -     1      │
│      [ ▼ ]       [ ▼ ]   │
│                          │
│        Reset Score       │
└──────────────────────────┘
```

Behavior to carry forward:
- Use vertical increment/decrement controls per team.
- Disable decrement at zero.
- Disable reset score at `0-0`.

### Current Porting Boundary

Port now:
- `Timer` visual structure into `TimeTabView`.
- `Edit Score` visual structure into `ScoreTabView`.
- `Game` control ideas into `AdminTabView`, keeping API settings.

Defer:
- `Game Type` implementation.
- Snapshot state sharing from the manual app.
- Widget-specific behavior.

## High-Priority Interaction Rules

1. One-tap score increment from live screen.
2. Pause/Resume always visible.
3. Timer displays remaining period time (countdown) and overtime (`+MM:SS over`).
4. `End Period` is always available, including when timer was not started.
5. `End Match` is always available from admin controls.
6. Destructive actions require confirmation.
7. Last action is always visible with quick undo.
8. Haptic feedback per critical event:
   - short tap: score event accepted
   - double tap: pause/resume
   - warning tap: sync delayed/offline

## Next Step for Prototyping

- Convert Design B + D into clickable SwiftUI prototype screens:
  - `TimeTabView`
  - `ScoreTabView`
  - `AdminTabView`
  - `JoinMatchView`
  - `MembersView`
