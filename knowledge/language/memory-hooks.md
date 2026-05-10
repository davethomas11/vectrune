---
id: language.memory-hooks
title: Memory Hooks — Signal/Observer Pattern for Reactivity
audience:
  - ai
  - human
sources:
  - src/memory/hooks.rs
  - src/memory/mod.rs
  - src/apps/rune_web/jscodegen.rs
---

# Memory Hooks — Pluggable Reactivity System

## Overview

Memory Hooks implement a Signal/Observer pattern that decouples memory changes from transport mechanisms. Instead of hard-coding WebSocket broadcasts, hooks provide a declarative way to bind memory changes to configurable observers.

**Key benefits:**
- ✅ Multiple observers per memory key (WebSocket, HTTP, SSE, Local)
- ✅ Configurable reactivity without code changes
- ✅ Works with or without WebSockets
- ✅ Supports custom logic on memory changes
- ✅ Granular control over what triggers updates

## Architecture

### Core Components

**1. MemorySignal** — Represents a memory change event
```rust
pub struct MemorySignal {
    pub key: String,
    pub old_value: Option<JsonValue>,
    pub new_value: JsonValue,
    pub timestamp: String,
}
```

**2. MemoryObserver** — Trait for different reaction strategies
```rust
#[async_trait]
pub trait MemoryObserver: Send + Sync {
    async fn on_change(&self, signal: &MemorySignal) -> Result<(), String>;
    fn name(&self) -> &str;
}
```

**3. HookRegistry** — Central registry managing subscriptions
```rust
pub struct HookRegistry {
    subscriptions: HashMap<String, Vec<String>>,    // key → observer_ids
    observers: HashMap<String, Arc<dyn MemoryObserver>>,
    hooks: HashMap<String, HookConfig>,
}
```

**4. ReactivityProvider** — Configurable transport layer
```rust
pub enum ReactivityProvider {
    WebSocket,  // Real-time via WebSocket
    Poll,       // Long-polling fallback
    SSE,        // Server-Sent Events
    None,       // No automatic broadcasting
}
```

## Built-in Observers

### WebSocketObserver
Broadcasts changes to all connected clients:
```rust
let observer = Arc::new(WebSocketObserver::new(
    "/ws".to_string(),
    Some("game".to_string()),
));
```

### WebhookObserver
Sends updates to an external HTTP endpoint:
```rust
let observer = Arc::new(WebhookObserver::new(
    "https://analytics.internal/track".to_string(),
    "POST".to_string(),
));
```

### SSEObserver
Queues events for Server-Sent Events clients (handles disconnections gracefully):
```rust
let observer = Arc::new(SSEObserver::new("game-updates".to_string()));
```

### LocalObserver
Updates local browser state directly (no network for single-user or WASM):
```rust
let observer = Arc::new(LocalObserver::new("board-component".to_string()));
```

## .rune Syntax — Declarative Hooks

### Basic Hook Declaration

```rune
@Hook/on_memory_change
target = global_score
run:
    log "Score moved from {old_value} to {new_value}"
```

The engine provides:
- `old_value` — Previous value
- `new_value` — Current value
- `key` — Memory key name
- `timestamp` — ISO8601 timestamp

### Hook with Webhook

```rune
@Hook/score_tracker
target = player_scores
observer = webhook
webhook_url = https://analytics.example.com/track
webhook_method = POST
run:
    # Custom logic before sending
    formatted = {"player": new_value.player, "score": new_value.score}
    http.post webhook_url formatted
```

### Hook with Custom Logic

```rune
@Hook/leaderboard_update
target = player_scores
observer = websocket
channel = leaderboard
run:
    # Only broadcast if score increased significantly
    if new_value.score > old_value.score + 100
        ws.broadcast /ws {"type": "milestone", "player": new_value.player}
```

### Multiple Observers per Key

```rune
@Hook/multiplayer_sync
target = game_state
observers = [websocket, webhook, local]
run:
    # Broadcast to all connected players
    ws.broadcast /ws {"type": "state_change", "state": new_value}
    
    # Log to analytics
    http.post "https://api/events" {"event": "game_state_changed"}
    
    # Sync local cache (for single-user fallback)
    set-local state_cache new_value
```

## Frontend Configuration

### Per-Frontend Reactivity Provider

```rune
@Frontend
type = rune-web
reactivity = websocket  # Options: websocket, poll, sse, none
endpoint = /ws
default_channel = app-updates
```

### Per-Event Publishing

```rune
@Event /ws update_ticket
publish = true            # Auto-broadcast on set-memory
channel = game-updates    # Optional: custom channel
run:
    board = get-memory sprint_board
    board.updated_at = now
    set-memory sprint_board board
    
    # If 'publish' is true, engine automatically broadcasts the update
    # using the specified channel
```

## Usage Example: Multiplayer Game

### Server (.rune file)

```rune
@App
name = Game Server
type = Rest

@Memory/game_state
@Memory/player_scores
@Websocket /ws

# Hook: Broadcast game state changes to all players
@Hook/game_state_sync
target = game_state
observer = websocket
channel = game
run:
    log "Broadcasting game state change"

# Hook: Track score changes for analytics
@Hook/score_analytics
target = player_scores
observer = webhook
webhook_url = https://analytics.internal/track
run:
    http.post webhook_url {
        "event": "score_change",
        "player_id": new_value.player_id,
        "old_score": old_value.score,
        "new_score": new_value.score
    }

@Event /ws player.move
publish = true
run:
    move = parse-json body
    
    state = get-memory game_state
    state.current_player = (state.current_player + 1) % state.total_players
    state.last_move = move
    
    set-memory game_state state  # Hooks trigger automatically
    
    scores = get-memory player_scores
    scores[state.current_player].moves_count = scores[state.current_player].moves_count + 1
    set-memory player_scores scores  # Triggers hook again

@Frontend
type = rune-web
reactivity = websocket
endpoint = /ws
```

### Frontend (.rune file)

```rune
@Page/game
view:
    div#game
        h1 "Round: {game_state.round}"
        div#scores for-each=score
            span "{score.player}: {score.points}"
        
        # This component subscribes to 'game_state'
        # When the hook broadcasts game_state changes,
        # this component automatically re-renders
```

### What Happens

1. **Player A makes a move** → calls `/ws player.move`
2. **Server updates memory** → `set-memory game_state state`
3. **Hook triggers** → WebSocketObserver caught the signal
4. **Broadcast happens** → Message sent to all connected clients
5. **Clients receive** → JavaScript listener updates memory
6. **Re-render** → Only "game" component re-renders (subscribed to game_state)
7. **UI updates** → All players see the new round and scores instantly

## Advanced: Custom Observers

Implement your own observer for specialized behavior:

```rust
pub struct CustomObserver {
    // Your fields
}

#[async_trait]
impl MemoryObserver for CustomObserver {
    async fn on_change(&self, signal: &MemorySignal) -> Result<(), String> {
        // Your custom logic
        match signal.key.as_str() {
            "player_position" => {
                // Update game physics
            }
            "collision_detected" => {
                // Trigger sound effect
            }
            _ => {}
        }
        Ok(())
    }

    fn name(&self) -> &str {
        "custom"
    }
}

// Register it
registry.register_observer(
    "custom1".to_string(),
    Arc::new(CustomObserver::new()),
).await;
```

## Configuration: ReactivityConfig

```rust
pub struct ReactivityConfig {
    pub provider: ReactivityProvider,      // WebSocket, Poll, SSE, None
    pub endpoint: String,                  // /ws, /events, etc.
    pub default_channel: Option<String>,   // routing/isolation
    pub enable_local_sync: bool,           // sync to browser memory
}
```

### Different Configurations

**WebSocket (Default — Real-time)**
```rust
ReactivityConfig {
    provider: ReactivityProvider::WebSocket,
    endpoint: "/ws".to_string(),
    default_channel: Some("app".to_string()),
    enable_local_sync: true,
}
```

**Server-Sent Events (Streaming)**
```rust
ReactivityConfig {
    provider: ReactivityProvider::SSE,
    endpoint: "/events".to_string(),
    default_channel: None,
    enable_local_sync: false,
}
```

**Long-polling (Fallback)**
```rust
ReactivityConfig {
    provider: ReactivityProvider::Poll,
    endpoint: "/api/poll".to_string(),
    default_channel: None,
    enable_local_sync: true,
}
```

**None (Manual control)**
```rust
ReactivityConfig {
    provider: ReactivityProvider::None,
    endpoint: "".to_string(),
    default_channel: None,
    enable_local_sync: false,
}
// Developers call ws.broadcast or http.post manually
```

## Comparison: Reactive Memory vs. Memory Hooks

| Feature | Reactive Memory | Memory Hooks |
|---------|---|---|
| Transport | Hard-coded WebSocket | Configurable (WS, Hook, HTTP, etc.) |
| Flexibility | Medium (only WS) | High (multiple observers) |
| Decoupling | Medium (still couples to broadcast) | High (full decoupling) |
| Custom Logic | Limited | Extensive via @Hook |
| Multiple Targets | No | Yes (many observers) |
| Overhead | Very Low | Low (same, with more features) |
| Learning Curve | Easy | Medium (more options) |

**Use Reactive Memory if:** You're building a straightforward real-time app with WebSockets.

**Use Memory Hooks if:** You need flexibility, custom logic, multiple observers, or non-WebSocket transports.

## Performance Considerations

### Performance: Hash Lookup vs. Linear Scan
- **Subscriptions stored in HashMap** — O(1) lookup per key
- **Multiple observers per key** — Still fast (typically 1-5 observers)
- **Emit cost** — ~microseconds for typical hook count

### Memory: Overhead
- **HookRegistry** — O(num_unique_keys + num_observers)
- **Typical app** — <10KB even with hundreds of keys

### Network: Batching
- **requestAnimationFrame** — Frontend batches updates in single frame
- **No duplicate broadcasts** — Same value = same signal = once per tick

## Testing Memory Hooks

```rust
#[tokio::test]
async fn test_hook_execution() {
    let registry = HookRegistry::new();
    
    let observer = Arc::new(WebSocketObserver::new("/ws".to_string(), None));
    registry.register_observer("ws1".to_string(), observer).await;
    
    let hook = HookConfig {
        id: "test_hook".to_string(),
        target_key: "score".to_string(),
        observers: vec!["ws1".to_string()],
        custom_logic: None,
    };
    registry.register_hook(hook).await;
    
    let signal = MemorySignal {
        key: "score".to_string(),
        old_value: Some(json!(100)),
        new_value: json!(150),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    
    assert!(registry.emit(signal).await.is_ok());
}
```

## FAQ

**Q: Can I use Memory Hooks AND Reactive Memory together?**  
A: Yes! Reactive Memory is a specialized case of Memory Hooks (just WebSocket observer + auto-registration).

**Q: What if an observer fails?**  
A: `emit()` returns `Result<(), Vec<String>>` with error details. You can decide whether to fail the entire update or continue with other observers.

**Q: How do I debug hooks?**  
A: Set log level to DEBUG. Each observer logs when it handles a change: `"Observer 'websocket' handled change to key 'game_state'"`

**Q: Can hooks have custom Rune logic?**  
A: Yes! The `custom_logic` field in HookConfig holds Rune code that runs before observers trigger.

## Related

- **Reactive Memory** (`language/reactive-memory.md`) — Simpler WebSocket-only approach
- **JavaScript Runtime** (`language/javascript-runtime.md`) — Frontend subscription tracking
- **Builtins** (`reference/builtins.yaml`) — `set-memory`, `get-memory`, `ws.broadcast`

