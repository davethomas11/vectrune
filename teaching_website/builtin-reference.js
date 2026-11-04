// builtin-reference.js - Catalog & interactive filtering for Vectrune Builtins

const VECTRUNE_BUILTINS = [
  {
    name: "log",
    category: "diagnostics",
    syntax: 'log "message with {placeholder}"',
    summary: "Log a diagnostic message and store the expanded string in the runtime context.",
    snippet: `@App\nname = Log Demo\ntype = REST\n\n@Route/GET /\nrun:\n    user = "Alice"\n    log "Welcome to Vectrune, {user}!"\n    respond 200 "OK"`
  },
  {
    name: "respond",
    category: "http",
    syntax: "respond <status_code> <payload>",
    summary: "Terminate step sequence and emit an HTTP response with status code and body payload.",
    snippet: `@App\nname = Respond Demo\ntype = REST\n\n@Route/GET /status\nrun:\n    respond 200 { ready: true, uptime: "99.9%" }`
  },
  {
    name: "return",
    category: "http",
    syntax: "return <payload>",
    summary: "Return structured data directly from GraphQL queries or REST handlers.",
    snippet: `@App\nname = Return Demo\ntype = REST\n\n@Route/GET /data\nrun:\n    data = [10, 20, 30]\n    return data`
  },
  {
    name: "parse-json",
    category: "data",
    syntax: "parsed = parse-json [source_var_or_literal]",
    summary: "Parse a JSON string into structured key-value maps or lists (defaults to `body`).",
    snippet: `@App\nname = JSON Demo\ntype = REST\n\n@Route/GET /\nrun:\n    raw = "{\\"score\\": 100, \\"active\\": true}"\n    obj = parse-json raw\n    log "Parsed score: {obj.score}"\n    respond 200 obj`
  },
  {
    name: "validate",
    category: "schema",
    syntax: "validate <target> #SchemaName | validate <condition> <error_msg>",
    summary: "Enforce type adherence against an @Schema or assert conditional expressions.",
    snippet: `@App\nname = Validate Demo\ntype = REST\n\n@Schema/User\nname = string\nage = number\n\n@Route/GET /\nrun:\n    u = { name: "Dave", age: 25 }\n    validate u #User\n    validate u.age >= 18 "Must be adult"\n    respond 200 "Validated!"`
  },
  {
    name: "memory.set / set-memory",
    category: "memory",
    syntax: "set-memory <key> <value>",
    summary: "Persist arbitrary values into reactive shared memory across HTTP requests.",
    snippet: `@App\nname = Memory Demo\ntype = REST\n\n@Route/GET /\nrun:\n    set-memory visitor_count 42\n    val = get-memory visitor_count\n    respond 200 { visitors: val }`
  },
  {
    name: "memory.get / get-memory",
    category: "memory",
    syntax: "val = get-memory <key>",
    summary: "Retrieve a previously saved entry from shared runtime memory.",
    snippet: `@App\nname = Memory Get Demo\ntype = REST\n\n@Route/GET /\nrun:\n    set-memory config { debug: true, max_connections: 50 }\n    cfg = get-memory config\n    respond 200 cfg`
  },
  {
    name: "memory.clear / clear-memory",
    category: "memory",
    syntax: "clear-memory",
    summary: "Flush all active keys and values stored in shared memory.",
    snippet: `@App\nname = Clear Memory Demo\ntype = REST\n\n@Route/GET /reset\nrun:\n    set-memory temp 123\n    clear-memory\n    remaining = get-memory temp\n    respond 200 { cleared: remaining == null }`
  },
  {
    name: "memory.del / del-memory",
    category: "memory",
    syntax: "del-memory <key>",
    summary: "Delete a specific key entry from shared memory.",
    snippet: `@App\nname = Del Memory Demo\ntype = REST\n\n@Route/GET /\nrun:\n    set-memory token "xyz"\n    del-memory token\n    respond 200 "Token removed"`
  },
  {
    name: "csv.read",
    category: "io",
    syntax: "rows = csv.read <file_path>",
    summary: "Parse a CSV file from disk into a list of structured row maps.",
    snippet: `@App\nname = CSV Demo\ntype = REST\n\n@Route/GET /users\nrun:\n    users = csv.read "users.csv"\n    respond 200 users`
  },
  {
    name: "csv.append",
    category: "io",
    syntax: "csv.append <file_path> <record_map>",
    summary: "Append a record or dictionary as a new row in an existing CSV file.",
    snippet: `@App\nname = CSV Append Demo\ntype = REST\n\n@Route/GET /\nrun:\n    new_row = { id: 3, name: "Charlie" }\n    csv.append "users.csv" new_row\n    respond 201 "Row appended"`
  },
  {
    name: "csv.write",
    category: "io",
    syntax: "csv.write <file_path> <records_list>",
    summary: "Overwrite or create a CSV file with an array of structured objects.",
    snippet: `@App\nname = CSV Write Demo\ntype = REST\n\n@Route/GET /\nrun:\n    data = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]\n    csv.write "users.csv" data\n    respond 200 "CSV updated"`
  },
  {
    name: "is-set",
    category: "context",
    syntax: "exists = is-set <variable_or_path>",
    summary: "Inspect runtime context or nested paths (e.g. `state.user.id`) to verify existence.",
    snippet: `@App\nname = IsSet Demo\ntype = REST\n\n@Route/GET /\nrun:\n    user = { profile: { name: "Dave" } }\n    has_name = is-set user.profile.name\n    has_email = is-set user.profile.email\n    respond 200 { name_exists: has_name, email_exists: has_email }`
  },
  {
    name: "delete",
    category: "context",
    syntax: "delete <variable_or_nested_path>",
    summary: "Remove a variable or nested property path from the current runtime context.",
    snippet: `@App\nname = Delete Context Demo\ntype = REST\n\n@Route/GET /\nrun:\n    payload = { secret: "12345", public_info: "Hello" }\n    delete payload.secret\n    respond 200 payload`
  },
  {
    name: "ws.broadcast",
    category: "websocket",
    syntax: "broadcast <message> | ws.broadcast /path <message>",
    summary: "Broadcast a message payload to all active connected WebSocket clients on a channel.",
    snippet: `@App\nname = Broadcast Demo\ntype = WebSocket\n\n@Route/WS /chat\nrun:\n    on message:\n        ws.broadcast /chat "Broadcast: {message}"`
  },
  {
    name: "load-rune",
    category: "io",
    syntax: "doc = load-rune <file_or_dir_path>",
    summary: "Load and dynamically parse an external .rune document into an active data graph.",
    snippet: `@App\nname = LoadRune Demo\ntype = REST\n\n@Route/GET /\nrun:\n    data = load-rune skateboarders.rune\n    respond 200 data`
  },
  {
    name: "to-number",
    category: "data",
    syntax: "num = to-number <string_or_variable>",
    summary: "Coerce a string or boolean into a floating-point number.",
    snippet: `@App\nname = ToNumber Demo\ntype = REST\n\n@Route/GET /\nrun:\n    raw_count = "42"\n    count = to-number raw_count\n    next_count = count + 1\n    respond 200 { parsed: count, next: next_count }`
  },
  {
    name: "to-string",
    category: "data",
    syntax: "str = to-string <numeric_or_variable>",
    summary: "Convert any value or expression into a string representation.",
    snippet: `@App\nname = ToString Demo\ntype = REST\n\n@Route/GET /\nrun:\n    total = 100\n    str_val = to-string total\n    respond 200 { formatted: str_val }`
  },
  {
    name: "to-bool",
    category: "data",
    syntax: "flag = to-bool <string_or_number_or_variable>",
    summary: "Coerce truthy/falsy strings ('true', '1') or numbers into a boolean.",
    snippet: `@App\nname = ToBool Demo\ntype = REST\n\n@Route/GET /\nrun:\n    flag_str = "true"\n    active = to-bool flag_str\n    respond 200 { is_active: active }`
  },
  {
    name: "uuid.v4 / uuid",
    category: "data",
    syntax: "id = uuid.v4",
    summary: "Generate a cryptographically random RFC 4122 version 4 UUID string.",
    snippet: `@App\nname = UUID Demo\ntype = REST\n\n@Route/GET /new-id\nrun:\n    user_id = uuid.v4\n    log "Generated UUID: {user_id}"\n    respond 200 { id: user_id }`
  },
  {
    name: "now",
    category: "data",
    syntax: "ts = now [\"iso\" | \"millis\" | \"unix\"]",
    summary: "Retrieve current UTC timestamp in ISO-8601 string, millisecond integer, or Unix seconds.",
    snippet: `@App\nname = Now Demo\ntype = REST\n\n@Route/GET /time\nrun:\n    iso_time = now\n    epoch_ms = now "millis"\n    respond 200 { iso: iso_time, millis: epoch_ms }`
  }
];

let activeFilterCategory = 'all';

function renderBuiltinCards() {
  const container = document.getElementById('builtin-list');
  if (!container) return;

  const searchInput = document.getElementById('builtin-search');
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  const filtered = VECTRUNE_BUILTINS.filter(item => {
    const matchesCategory = activeFilterCategory === 'all' || item.category === activeFilterCategory;
    const matchesQuery = !query || 
      item.name.toLowerCase().includes(query) || 
      item.summary.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.syntax.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-results">
        <p>No builtins matched your search criteria.</p>
        <button class="pill" onclick="resetBuiltinFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <article class="builtin-card" data-category="${item.category}">
      <div class="builtin-card-header">
        <h4 class="builtin-name">${item.name}</h4>
        <span class="category-badge cat-${item.category}">${item.category}</span>
      </div>
      <p class="builtin-summary">${item.summary}</p>
      <div class="builtin-syntax-box">
        <code class="code-block language-rune">${escapeHtml(item.syntax)}</code>
      </div>
      <div class="builtin-card-actions">
        <button class="load-sandbox-btn" data-builtin-name="${escapeHtml(item.name)}" onclick="loadBuiltinIntoSandbox(this.dataset.builtinName)">
          ▶ Load into Sandbox
        </button>
      </div>
    </article>
  `).join('');
}

function selectCategory(category, button) {
  activeFilterCategory = category;
  document.querySelectorAll('.category-pills .pill').forEach(btn => btn.classList.remove('active'));
  if (button) button.classList.add('active');
  renderBuiltinCards();
}

function filterBuiltins() {
  renderBuiltinCards();
}

function resetBuiltinFilters() {
  activeFilterCategory = 'all';
  const searchInput = document.getElementById('builtin-search');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.category-pills .pill').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === 0);
  });
  renderBuiltinCards();
}

function loadBuiltinIntoSandbox(builtinName) {
  const item = VECTRUNE_BUILTINS.find(b => b.name === builtinName);
  if (!item || !item.snippet) return;

  const editor = document.querySelector('#sandbox-editor');
  if (editor) {
    editor.value = item.snippet;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Auto execute or highlight
    const runBtn = document.querySelector('#run-button');
    if (runBtn) {
      runBtn.classList.add('pulse-highlight');
      setTimeout(() => runBtn.classList.remove('pulse-highlight'), 1200);
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BUILTIN_DEMO_CODE = `@App
name = Builtin Reference Playground
type = REST

@Schema/Item
name = string
price = number

@Route/GET /demo
run:
    log "1. Diagnostics: Running builtin demo..."
    
    # Context & Collections
    items = [
        { name: "Skateboard Deck", price: 55 },
        { name: "Urethane Wheels", price: 30 }
    ]
    is_valid = is-set items
    log "Context check: items is set = {is_valid}"
    
    # Memory Operations
    set-memory active_session "session_98234"
    retrieved = get-memory active_session
    log "Memory storage test: {retrieved}"
    
    # JSON Parsing & Validation
    sample_json = "{\\"name\\": \\"Grip Tape\\", \\"price\\": 12}"
    parsed_item = parse-json sample_json
    validate parsed_item #Item
    log "Validated item: {parsed_item.name} (\${parsed_item.price})"
    
    # Response
    respond 200 {
        status: "success",
        memory: retrieved,
        item: parsed_item,
        inventory: items
    }
`;

function initBuiltinDemoSandbox() {
  const editor = document.querySelector('#sandbox-editor');
  if (editor) {
    const isBuiltinsPage = Boolean(document.getElementById('builtin-list'));
    if (isBuiltinsPage && (!editor.dataset.initialized || editor.value.includes('name: "Skateboard Deck"') || editor.value.includes('name = Sandbox'))) {
      editor.value = BUILTIN_DEMO_CODE;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dataset.initialized = 'true';
    }
  }
}

// Auto-initialize when DOM is ready or component mounts
function setupBuiltins() {
  renderBuiltinCards();
  initBuiltinDemoSandbox();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBuiltins);
} else {
  setupBuiltins();
}

// Observe page changes in Rune Web
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (document.getElementById('builtin-list')) {
      if (!document.querySelector('.builtin-card')) {
        renderBuiltinCards();
      }
      initBuiltinDemoSandbox();
      break;
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
