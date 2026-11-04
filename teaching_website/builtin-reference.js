// builtin-reference.js - Catalog & interactive filtering for Vectrune Builtins

const VECTRUNE_BUILTINS = [
  {
    name: "summarize",
    category: "data",
    syntax: "report = summarize records by field [sum|avg|min|max|median|distinct|first|last value_field]",
    snippet: "@App\nname = One-line Reports\ntype = REST\n\n@Route/GET /report\nrun:\n    sales = [\n        { region: \"West\", amount: 125, customer: \"alice\" },\n        { region: \"East\", amount: 40, customer: \"bob\" },\n        { region: \"West\", amount: 25, customer: \"alice\" },\n        { region: \"East\", amount: 60, customer: \"carol\" },\n        { region: \"South\", amount: 30, customer: \"dave\" }\n    ]\n    # Try median amount, distinct customer, first customer, or last customer.\n    report = summarize sales by region sum amount\n    respond 200 report"
  },
  {
    name: "log",
    category: "diagnostics",
    syntax: 'log "message with {placeholder}"',
    snippet: `@App\nname = Log Demo\ntype = REST\n\n@Route/GET /\nrun:\n    user = "Alice"\n    log "Welcome to Vectrune, {user}!"\n    respond 200 "OK"`
  },
  {
    name: "respond",
    category: "http",
    syntax: "respond <status_code> <payload>",
    snippet: `@App\nname = Respond Demo\ntype = REST\n\n@Route/GET /status\nrun:\n    respond 200 { ready: true, uptime: "99.9%" }`
  },
  {
    name: "return",
    category: "http",
    syntax: "return <payload>",
    snippet: `@App\nname = Return Demo\ntype = REST\n\n@Route/GET /data\nrun:\n    data = [10, 20, 30]\n    return data`
  },
  {
    name: "parse-json",
    category: "data",
    syntax: "parsed = parse-json [source_var_or_literal]",
    snippet: `@App\nname = JSON Demo\ntype = REST\n\n@Route/GET /\nrun:\n    raw = "{\\"score\\": 100, \\"active\\": true}"\n    obj = parse-json raw\n    log "Parsed score: {obj.score}"\n    respond 200 obj`
  },
  {
    name: "validate",
    category: "schema",
    syntax: "validate <target> #SchemaName | validate <condition> <error_msg>",
    snippet: `@App\nname = Validate Demo\ntype = REST\n\n@Schema/User\nname = string\nage = number\n\n@Route/GET /\nrun:\n    u = { name: "Dave", age: 25 }\n    validate u #User\n    validate u.age >= 18 "Must be adult"\n    respond 200 "Validated!"`
  },
  {
    name: "memory.set / set-memory",
    category: "memory",
    syntax: "set-memory <key> <value>",
    snippet: `@App\nname = Memory Demo\ntype = REST\n\n@Route/GET /\nrun:\n    set-memory visitor_count 42\n    val = get-memory visitor_count\n    respond 200 { visitors: val }`
  },
  {
    name: "memory.get / get-memory",
    category: "memory",
    syntax: "val = get-memory <key>",
    snippet: `@App\nname = Memory Get Demo\ntype = REST\n\n@Route/GET /\nrun:\n    set-memory config { debug: true, max_connections: 50 }\n    cfg = get-memory config\n    respond 200 cfg`
  },
  {
    name: "memory.clear / clear-memory",
    category: "memory",
    syntax: "clear-memory",
    snippet: `@App\nname = Clear Memory Demo\ntype = REST\n\n@Route/GET /reset\nrun:\n    set-memory temp 123\n    clear-memory\n    remaining = get-memory temp\n    respond 200 { cleared: remaining == null }`
  },
  {
    name: "memory.del / del-memory",
    category: "memory",
    syntax: "del-memory <key>",
    snippet: `@App\nname = Del Memory Demo\ntype = REST\n\n@Route/GET /\nrun:\n    set-memory token "xyz"\n    del-memory token\n    respond 200 "Token removed"`
  },
  {
    name: "csv.read",
    category: "io",
    syntax: "rows = csv.read <file_path>",
    snippet: `@App\nname = CSV Demo\ntype = REST\n\n@Route/GET /users\nrun:\n    users = csv.read "users.csv"\n    respond 200 users`
  },
  {
    name: "csv.append",
    category: "io",
    syntax: "csv.append <file_path> <record_map>",
    snippet: `@App\nname = CSV Append Demo\ntype = REST\n\n@Route/GET /\nrun:\n    new_row = { id: 3, name: "Charlie" }\n    csv.append "users.csv" new_row\n    respond 201 "Row appended"`
  },
  {
    name: "csv.write",
    category: "io",
    syntax: "csv.write <file_path> <records_list>",
    snippet: `@App\nname = CSV Write Demo\ntype = REST\n\n@Route/GET /\nrun:\n    data = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]\n    csv.write "users.csv" data\n    respond 200 "CSV updated"`
  },
  {
    name: "is-set",
    category: "context",
    syntax: "exists = is-set <variable_or_path>",
    snippet: `@App\nname = IsSet Demo\ntype = REST\n\n@Route/GET /\nrun:\n    user = { profile: { name: "Dave" } }\n    has_name = is-set user.profile.name\n    has_email = is-set user.profile.email\n    respond 200 { name_exists: has_name, email_exists: has_email }`
  },
  {
    name: "delete",
    category: "context",
    syntax: "delete <variable_or_nested_path>",
    snippet: `@App\nname = Delete Context Demo\ntype = REST\n\n@Route/GET /\nrun:\n    payload = { secret: "12345", public_info: "Hello" }\n    delete payload.secret\n    respond 200 payload`
  },
  {
    name: "ws.broadcast",
    category: "websocket",
    syntax: "broadcast <message> | ws.broadcast /path <message>",
    snippet: `@App\nname = Broadcast Demo\ntype = REST\n\n@Websocket/chat\non_message:\n    ws.broadcast /chat body`
  },
  {
    name: "load-rune",
    category: "io",
    syntax: "doc = load-rune <file_or_dir_path>",
    snippet: `@App\nname = LoadRune Demo\ntype = REST\n\n@Route/GET /\nrun:\n    data = load-rune skateboarders.rune\n    respond 200 data`
  },
  {
    name: "to-number",
    category: "data",
    syntax: "num = to-number <string_or_variable>",
    snippet: `@App\nname = ToNumber Demo\ntype = REST\n\n@Route/GET /\nrun:\n    raw_count = "42"\n    count = to-number raw_count\n    next_count = count + 1\n    respond 200 { parsed: count, next: next_count }`
  },
  {
    name: "to-string",
    category: "data",
    syntax: "str = to-string <numeric_or_variable>",
    snippet: `@App\nname = ToString Demo\ntype = REST\n\n@Route/GET /\nrun:\n    total = 100\n    str_val = to-string total\n    respond 200 { formatted: str_val }`
  },
  {
    name: "to-bool",
    category: "data",
    syntax: "flag = to-bool <string_or_number_or_variable>",
    snippet: `@App\nname = ToBool Demo\ntype = REST\n\n@Route/GET /\nrun:\n    flag_str = "true"\n    active = to-bool flag_str\n    respond 200 { is_active: active }`
  },
  {
    name: "uuid.v4 / uuid",
    category: "data",
    syntax: "id = uuid.v4",
    snippet: `@App\nname = UUID Demo\ntype = REST\n\n@Route/GET /new-id\nrun:\n    user_id = uuid.v4\n    log "Generated UUID: {user_id}"\n    respond 200 { id: user_id }`
  },
  {
    name: "now",
    category: "data",
    syntax: "ts = now [\"iso\" | \"millis\" | \"unix\"]",
    snippet: `@App\nname = Now Demo\ntype = REST\n\n@Route/GET /time\nrun:\n    iso_time = now\n    epoch_ms = now "millis"\n    respond 200 { iso: iso_time, millis: epoch_ms }`
  }
];

function builtinSummary(item) {
  const key = item.name.split(' / ')[0].replace(/[^a-z0-9]/g, '_');
  return window.siteText('BuiltinSummary.' + key);
}

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
      builtinSummary(item).toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.syntax.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-results">
        <p>${escapeHtml(window.siteText('Reference.empty'))}</p>
        <button class="pill" onclick="resetBuiltinFilters()">${escapeHtml(window.siteText('Reference.reset'))}</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <article class="builtin-card" data-category="${item.category}">
      <div class="builtin-card-header">
        <h4 class="builtin-name">${item.name}</h4>
        <span class="category-badge cat-${item.category}">${escapeHtml(window.siteText('Reference.' + item.category))}</span>
      </div>
      <p class="builtin-summary">${escapeHtml(builtinSummary(item))}</p>
      <div class="builtin-syntax-box">
        <code class="code-block language-rune">${escapeHtml(item.syntax)}</code>
      </div>
      <div class="builtin-card-actions">
        <button class="load-sandbox-btn" data-builtin-name="${escapeHtml(item.name)}" onclick="loadBuiltinIntoSandbox(this.dataset.builtinName)">
          ▶ ${escapeHtml(window.siteText('Reference.load'))}
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

// Initialize each mounted list once, including when a search has no results.
const initializedBuiltinLists = new WeakSet();
function setupBuiltins() {
  const container = document.getElementById('builtin-list');
  if (!container || initializedBuiltinLists.has(container)) return;
  initializedBuiltinLists.add(container);
  activeFilterCategory = 'all';
  renderBuiltinCards();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBuiltins);
} else {
  setupBuiltins();
}

// Observe page changes in Rune Web
const observer = new MutationObserver(setupBuiltins);
observer.observe(document.body, { childList: true, subtree: true });
