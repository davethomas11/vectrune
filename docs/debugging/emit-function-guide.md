# Emit Function Debug Guide

## What Was Fixed

The `executeStatement` function in the generated JavaScript now properly handles function calls like `window.__runeWebEmit(eventName, payload)`.

**Previously:** The function call was passed to `executeStatement` but ignored because it didn't match any known patterns (assignments, increments, etc.).

**Now:** Function calls containing `(` and `)` are parsed, and if they're calls to `window.__runeWebEmit`, the arguments are evaluated and the function is executed.

## Browser Console Debug Commands

### 1. Check if emit action is defined
```javascript
window.runeWebApp.actionDefinitions?.emit
// Should output:
// {
//   params: ["event_name", "payload"],
//   steps: [
//     {Statement: "window.__runeWebEmit(event_name, payload)"}
//   ]
// }
```

### 2. Check WebSocket connection
```javascript
window.__runeWebSocket
// Should show WebSocket object
console.log('WebSocket state:', window.__runeWebSocket.readyState)
// 0 = CONNECTING
// 1 = OPEN
// 2 = CLOSING
// 3 = CLOSED
```

### 3. Manually test emit
```javascript
// This will send a test message to the server
window.__runeWebEmit('test_event', { message: 'hello from console' })
```

### 4. Check button event binding
```javascript
const btn = document.querySelector('button')
console.log('Button data attributes:')
console.log('  data-on-click:', btn?.getAttribute('data-on-click'))
```

### 5. Set breakpoint and trace emit
In DevTools, set a breakpoint here and click the button:

```javascript
// Around line in generated code where:
function executeStatement(statement, locals) {
  // ... search for this line:
  if (funcName === 'window.__runeWebEmit') {
    // SET BREAKPOINT HERE
    const args = argsStr ? splitTopLevel(argsStr, ',').map(arg => evaluateExpression(arg, buildScope(locals))) : [];
    if (window.__runeWebEmit && typeof window.__runeWebEmit === 'function') {
      window.__runeWebEmit.apply(null, args);  // <-- BREAKPOINT
    }
  }
}
```

When you hit the breakpoint:
- `funcName` should be `"window.__runeWebEmit"`
- `args` should contain `["update_score", {add: 1}]`
- Stepping over should send the WebSocket message

### 6. Watch WebSocket messages in Network tab
1. Open DevTools → Network tab
2. Find your WebSocket connection (should show as "ws://...")
3. Click it and go to "Messages" tab
4. Click your button
5. You should see message sent:
```json
{
  "event": "update_score",
  "payload": { "add": 1 }
}
```

## How Emit Works Now

1. **Click handler** → `bindEvent('click')` listener fires
2. **Element selection** → finds element with `data-on-click="emit('update_score', {'add':1})"`
3. **Parse handler** → `parseHandlerSpec` returns `{name: "emit", args: ["'update_score'", "{'add':1}"]}`
4. **Invoke action** → calls `app.invokeAction("emit", args, locals)`
5. **Execute steps** → processes the statement `window.__runeWebEmit(event_name, payload)`
6. **Parse function call** → detects `window.__runeWebEmit(...)` pattern
7. **Evaluate arguments** → converts `event_name` and `payload` using scope
8. **Call function** → executes `window.__runeWebEmit.apply(null, [evaluated_args])`
9. **Send message** → WebSocket sends JSON: `{event: "update_score", payload: {add: 1}}`

## If It's Still Not Working

Check these in order:

1. **Button has correct attribute**
   ```javascript
   document.querySelector('button').getAttribute('data-on-click')
   // Should be: emit('update_score', {'add':1})
   ```

2. **emit action is defined**
   ```javascript
   window.runeWebApp.actionDefinitions.emit
   // Should NOT be undefined
   ```

3. **WebSocket is OPEN**
   ```javascript
   console.log(window.__runeWebSocket.readyState === 1)
   // Should be: true
   ```

4. **Function call parsing is working**
   ```javascript
   // In console, test the statement execution:
   // Look in executeStatement for this check
   const trimmed = "window.__runeWebEmit('test', {})";
   console.log(trimmed.includes('(') && trimmed.endsWith(')'))
   // Should be: true
   ```

5. **window.__runeWebEmit exists**
   ```javascript
   console.log(typeof window.__runeWebEmit)
   // Should be: "function"
   ```

