import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/index';

// ---------------------------------------------------------------------------
// @App parsing
// ---------------------------------------------------------------------------

describe('parser — @App', () => {
  it('parses basic app section', () => {
    const doc = parse(`
#!RUNE

@App
name = User API
type = REST
version = 1.0
`);
    expect(doc.shebang).toBe(true);
    expect(doc.app).not.toBeNull();
    expect(doc.app!.name).toBe('User API');
    expect(doc.app!.type).toBe('REST');
    expect(doc.app!.version).toBe('1.0');
  });

  it('parses app with run: block', () => {
    const doc = parse(`
@App
name = Boot App
type = REST
run:
    log "starting up"
    memory.set items []
`);
    expect(doc.app!.run).toHaveLength(2);
    expect(doc.app!.run[0]).toMatchObject({ kind: 'builtin', name: 'log' });
    expect(doc.app!.run[1]).toMatchObject({ kind: 'builtin', name: 'memory.set' });
  });
});

// ---------------------------------------------------------------------------
// @Schema parsing
// ---------------------------------------------------------------------------

describe('parser — @Schema', () => {
  it('parses flat key=type schema', () => {
    const doc = parse(`
@Schema/User
id = number
name = string
email = string
`);
    expect(doc.schemas['User']).toBeDefined();
    expect(doc.schemas['User'].fields).toMatchObject({
      id: 'number',
      name: 'string',
      email: 'string',
    });
  });

  it('parses fields: block style schema', () => {
    const doc = parse(`
@Schema/Skater
fields:
    name: String
    age: Integer
    style: String
`);
    expect(doc.schemas['Skater'].fields).toMatchObject({
      name: 'String',
      age: 'Integer',
      style: 'String',
    });
  });
});

// ---------------------------------------------------------------------------
// @Route parsing
// ---------------------------------------------------------------------------

describe('parser — @Route', () => {
  it('parses GET route with run: block', () => {
    const doc = parse(`
@Route/GET /users
run:
    log "Fetching all users"
    users = csv.read "users.csv"
    respond 200 users
`);
    expect(doc.routes).toHaveLength(1);
    const route = doc.routes[0];
    expect(route.method).toBe('GET');
    expect(route.path).toBe('/users');
    expect(route.run).toHaveLength(3);
    expect(route.run[0]).toMatchObject({ kind: 'builtin', name: 'log' });
    expect(route.run[1]).toMatchObject({ kind: 'assignment', lhs: 'users' });
    expect(route.run[2]).toMatchObject({ kind: 'builtin', name: 'respond' });
  });

  it('parses parameterized GET route', () => {
    const doc = parse(`
@Route/GET /users/{id}
run:
    users = csv.read "users.csv"
    user = users.find it.id == id
    if user == null:
        respond 404 "User not found"
    respond 200 user
`);
    const route = doc.routes[0];
    expect(route.path).toBe('/users/{id}');
    // Should have: assignment(users), assignment(user), if, respond
    expect(route.run.length).toBeGreaterThanOrEqual(3);
    const ifStep = route.run.find(s => s.kind === 'if');
    expect(ifStep).toBeDefined();
    if (ifStep?.kind === 'if') {
      expect(ifStep.condition).toBe('user == null');
    }
  });

  it('parses POST route with expect and parse-json', () => {
    const doc = parse(`
@Route/POST /users
expect = User
run:
    parse-json
    validate body #User
    respond 201 "User added"
`);
    const route = doc.routes[0];
    expect(route.method).toBe('POST');
    expect(route.expect).toBe('User');
    const parseJsonStep = route.run.find(s => s.kind === 'builtin' && (s as { name: string }).name === 'parse-json');
    expect(parseJsonStep).toBeDefined();
  });

  it('parses multiple routes', () => {
    const doc = parse(`
@Route/GET /items
run:
    respond 200 []

@Route/POST /items
run:
    respond 201 "Created"

@Route/DELETE /items/{id}
run:
    respond 200 "Deleted"
`);
    expect(doc.routes).toHaveLength(3);
    expect(doc.routes.map(r => r.method)).toEqual(['GET', 'POST', 'DELETE']);
  });

  it('strips # comments', () => {
    const doc = parse(`
# This is a comment
@App
name = Test API   # inline comment not supported but section parses
type = REST
`);
    expect(doc.app!.name).toBe('Test API   # inline comment not supported but section parses');
  });

  it('handles import declarations', () => {
    const doc = parse(`
#!RUNE
import "parts"
import "shared.rune"

@App
name = Import Test
type = REST
`);
    expect(doc.imports).toEqual(['parts', 'shared.rune']);
  });
});

// ---------------------------------------------------------------------------
// Real example: user_api.rune structure
// ---------------------------------------------------------------------------

describe('parser — user_api.rune structure', () => {
  const source = `
#!RUNE

@App
name = User API
version = 1.0
type = REST
swagger = true

@Schema/User
id = number
name = string
email = string

@Route/GET /users
run:
    log "Fetching all users"
    users = csv.read "users.csv"
    respond 200 users

@Route/POST /users
expect = User
run:
    parse-json
    validate body #User
    users = csv.read "users.csv"
    user = users.find it.id == body.id
    if user != null:
        respond 400 "User exists already"
    log "Adding new user"
    csv.append "users.csv" body
    respond 201 "User added"

@Route/GET /users/{id}
run:
    log "Fetching user with ID: {id}"
    users = csv.read "users.csv"
    user = users.find it.id == id
    if user == null:
        respond 404 "User not found"
    respond 200 user

@Route/DELETE /users/{id}
run:
    log "Deleting user with ID: {id}"
    users = csv.read "users.csv"
    if users == null:
        respond 404 "User not found"
    respond 200 "User deleted"
`;

  it('has 4 routes', () => {
    const doc = parse(source);
    expect(doc.routes).toHaveLength(4);
  });

  it('has User schema with 3 fields', () => {
    const doc = parse(source);
    expect(Object.keys(doc.schemas['User'].fields)).toHaveLength(3);
  });

  it('routes have correct methods', () => {
    const doc = parse(source);
    expect(doc.routes.map(r => r.method)).toEqual(['GET', 'POST', 'GET', 'DELETE']);
  });
});
