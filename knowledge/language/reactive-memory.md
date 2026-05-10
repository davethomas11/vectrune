---
id: language.reactive-memory
title: Reactive Memory for Rune-Web
audience:
  - ai
  - human
sources:
  - src/memory/reactive.rs
  - src/apps/rune_web/jscodegen.rs
  - src/memory/mod.rs
---

# Reactive Memory for Rune-Web

## Overview

Reactive memory automatically broadcasts server-side memory updates to all connected clients via WebSocket. When a component renders and reads a memory key, it subscribes to that key. If the key changes, only subscribed components re-render — no manual refresh or polling needed.

## Architecture

### Backend: ReactiveMemoryBackend (`src/memory/reactive.rs`)

Wraps any existing `MemoryBackend` and adds broadcasting:

```rust
pub struct ReactiveMemoryBackend {
    inner: Arc<dyn MemoryBackend + Send + Sync>,
    config: ReactiveMemoryConfig,
}
```

**When you call `set-memory key value`:**
1. Update is stored in the inner backend
2. Message is constructed: `{type: "memory_update", key, value, timestamp}`
3. Message is broadcast to all connected WebSocket clients on the configured path

**Broadcast Modes:**
- `BroadcastMode::All` — broadcast every update
- `BroadcastMode::Prefixes(vec!["game_", "player_"])` — only keys with these prefixes
- `BroadcastMode::OptIn(vec!["state", "score"])` — only whitelisted keys

### Frontend: Subscription Tracking (JavaScript)

The generated JavaScript runtime includes:

1. **Subscription Map** — tracks `key → Set<componentId>`
   ```javascript
   const memorySubscriptions = {
       "game_state": new Set(["board", "status"]),
       "player_score": new Set(["leaderboard"])
   };
   ```

2. **Proxy-Based Registration** — intercepts memory reads during render
   ```javascript
   const stateProxy = new Proxy(memoryState, {
       get(target, prop) {
           if (window.__renderingComponent && typeof prop === 'string') {
               if (!memorySubscriptions[prop]) memorySubscriptions[prop] = new Set();
               memorySubscriptions[prop].add(window.__renderingComponent);
           }
           return target[prop];
       }
   });
   ```

3. **WebSocket Listener** — handles `memory_update` messages
   ```javascript
   window.__ws.addEventListener('message', (event) => {
       const data = JSON.parse(event.data);
       if (data.type === 'memory_update' && data.key) {
           memoryState[data.key] = data.value;
           // Trigger re-renders for subscribed components
       }
   });
   ```

4. **requestAnimationFrame Batching** — efficient re-renders
   ```javascript
   if (memorySubscriptions[data.key]) {
       memorySubscriptions[data.key].forEach((componentId) => {
           requestAnimationFrame(() => {
               // Re-render only this component
           });
       });
   }
   ```

## Usage

### Setup (Backend)

```rust
use crate::memory::reactive::{ReactiveMemoryBackend, ReactiveMemoryConfig, BroadcastMode};

let config = ReactiveMemoryConfig {
    ws_path: "/ws".to_string(),
    broadcast_mode: BroadcastMode::All,
};

let inner = Arc::new(InMemoryBackend::new());
let backend = Arc::new(ReactiveMemoryBackend::new(inner, config));

// Use this backend instead of the plain one
```

### Usage in .rune Files

No changes needed! Just use normal `.rune` code:

```rune
@App
name = Game
type = Rest

@Memory/game_state
@Websocket /ws

@Event /ws game.update
run:
    state = get-memory game_state
    state.round = state.round + 1
    set-memory game_state state  # Automatically broadcasts!
    return {"status": "ok"}

@Frontend type = rune-web
page = board

@Page/board
view:
    div#board
        h1 "Round: {game_state.round}"
        div "Phase: {game_state.phase}"
```

When `set-memory game_state state` is called:
1. Backend broadcasts the update
2. Client receives it
3. Only components that read `game_state` re-render
4. DOM automatically updates

## Message Format

### Memory Update Message (WebSocket)

```json
{
    "type": "memory_update",
    "key": "game_state",
    "value": {
        "round": 3,
        "phase": "playing"
    },
    "timestamp": "2026-05-09T14:30:45.123456Z"
}
```

## Configuration

### Broadcast Modes

**All (default)**
```rust
broadcast_mode: BroadcastMode::All
```
Every `set-memory` call broadcasts.

**Prefixes**
```rust
broadcast_mode: BroadcastMode::Prefixes(vec!["game_", "player_"])
```
Only broadcast keys starting with "game_" or "player_".

**OptIn**
```rust
broadcast_mode: BroadcastMode::OptIn(vec!["game_state", "leaderboard"])
```
Only broadcast these specific keys.

## Performance

### Memory
- Subscription map: O(num_unique_keys_accessed)
- Typically < 1KB for most applications

### CPU
- Proxy interception: < 1μs per read
- WebSocket message construction: < 1ms
- Re-render: Only affected components (not entire page)

### Network
- One message per state change
- ~200 bytes per update
- Use broadcast modes to reduce traffic if needed

## How It Works: Example

**Scenario:** Multiplayer game, 3 connected players, board with score displays

1. **Player A moves** → triggers `@Event /ws game.move`
2. **Server updates:**
   ```rune
   state = get-memory game_state
   state.current_player = (state.current_player + 1) % 3
   scores = get-memory player_scores
   scores[A] = scores[A] + 10
   set-memory game_state state
   set-memory player_scores scores
   ```
3. **Backend broadcasts two messages:**
   - `{type: "memory_update", key: "game_state", value: {...}}`
   - `{type: "memory_update", key: "player_scores", value: {...}}`
4. **Each client receives both messages**
5. **Subscription map tells us:**
   - `game_state` → subscribed by: `["board", "status"]`
   - `player_scores` → subscribed by: `["leaderboard", "score-A", "score-B", "score-C"]`
6. **Re-renders scheduled:**
   - Client A: `board`, `status`, `leaderboard`, `score-A`, `score-B`, `score-C`
   - Client B: same
   - Client C: same
7. **All three see updates instantly**

## Testing

Test it with two browser windows:

1. Open `http://localhost/game` in two tabs
2. From Tab 1, trigger an action that updates memory
3. Watch Tab 2 update instantly without refresh

## Key Concepts

### Subscription
A component "subscribes" by reading a memory key during render:
```html
<div>{game_state.round}</div>
```
This component depends on `game_state`.

### Targeted Re-render
Only subscribed components re-render. If 100 components exist but only 2 read `game_state`, only those 2 update.

### Broadcast Mode
Controls network overhead by filtering which keys are broadcast.

### requestAnimationFrame
Browser's native batching. Multiple re-renders in one frame are coalesced into one paint cycle.

## Related

- **JavaScript Runtime** (`language/javascript-runtime.md`) — More on generated code
- **Rune-Web Architecture** (`language/rune-web-architecture.md`) — Component rendering
- **Builtins** (`reference/builtins.yaml`) — `set-memory`, `get-memory`, `del-memory`

