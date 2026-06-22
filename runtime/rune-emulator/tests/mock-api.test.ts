import { describe, it, expect } from 'vitest';
import { parse, createApp } from '../src/index';

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

describe('mock-api — route matching', () => {
  const source = `
@App
name = Test
type = REST

@Route/GET /users
run:
    users = csv.read "users.csv"
    respond 200 users

@Route/GET /users/{id}
run:
    users = csv.read "users.csv"
    user = users.find it.id == id
    if user == null:
        respond 404 "Not found"
    respond 200 user

@Route/POST /users
run:
    parse-json
    csv.append "users.csv" body
    respond 201 "Created"

@Route/DELETE /users/{id}
run:
    respond 200 "Deleted"
`;

  const seedUsers = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ];

  it('GET /users returns all seeded users', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seedUsers } });
    const res = app.request({ method: 'GET', path: '/users' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(seedUsers);
  });

  it('GET /users/1 returns the matching user', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seedUsers } });
    const res = app.request({ method: 'GET', path: '/users/1' });
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe('Alice');
  });

  it('GET /users/999 returns 404 when user not found', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seedUsers } });
    const res = app.request({ method: 'GET', path: '/users/999' });
    expect(res.status).toBe(404);
  });

  it('POST /users with JSON body appends a new user', () => {
    const app = createApp(parse(source), { files: { 'users.csv': [...seedUsers] } });
    const newUser = { id: '3', name: 'Charlie', email: 'charlie@example.com' };
    const res = app.request({
      method: 'POST',
      path: '/users',
      body: JSON.stringify(newUser),
    });
    expect(res.status).toBe(201);
    expect(app.fileStore['users.csv']).toHaveLength(3);
  });

  it('DELETE /users/1 returns 200', () => {
    const app = createApp(parse(source), { files: { 'users.csv': [...seedUsers] } });
    const res = app.request({ method: 'DELETE', path: '/users/1' });
    expect(res.status).toBe(200);
  });

  it('unknown route returns 404', () => {
    const app = createApp(parse(source), {});
    const res = app.request({ method: 'GET', path: '/unknown' });
    expect(res.status).toBe(404);
  });

  it('wrong method returns 404', () => {
    const app = createApp(parse(source), {});
    const res = app.request({ method: 'PATCH', path: '/users' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: the actual user_api.rune example
// ---------------------------------------------------------------------------

describe('mock-api — user_api.rune round-trip', () => {
  const source = `
#!RUNE

@App
name = User API
version = 1.0
type = REST

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
    respond 200 "User deleted"
`;

  const seed = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ];

  it('GET /users returns seeded list', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seed } });
    const res = app.request({ method: 'GET', path: '/users' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBe(2);
  });

  it('GET /users logs a message', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seed } });
    const res = app.request({ method: 'GET', path: '/users' });
    expect(res.logs.some(l => l.includes('Fetching all users'))).toBe(true);
  });

  it('POST /users with valid body adds a user', () => {
    const app = createApp(parse(source), { files: { 'users.csv': [...seed] } });
    const newUser = { id: 3, name: 'Charlie', email: 'c@example.com' };
    const res = app.request({
      method: 'POST',
      path: '/users',
      body: JSON.stringify(newUser),
    });
    expect(res.status).toBe(201);
    expect(app.fileStore['users.csv']).toHaveLength(3);
  });

  it('POST /users with duplicate ID returns 400', () => {
    const app = createApp(parse(source), { files: { 'users.csv': [...seed] } });
    const dup = { id: 1, name: 'Alice2', email: 'a2@example.com' };
    const res = app.request({
      method: 'POST',
      path: '/users',
      body: JSON.stringify(dup),
    });
    expect(res.status).toBe(400);
  });

  it('GET /users/1 returns Alice', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seed } });
    const res = app.request({ method: 'GET', path: '/users/1' });
    expect(res.status).toBe(200);
    expect((res.body as { name: string }).name).toBe('Alice');
  });

  it('GET /users/999 returns 404', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seed } });
    const res = app.request({ method: 'GET', path: '/users/999' });
    expect(res.status).toBe(404);
  });

  it('GET /users/{id} log includes the id', () => {
    const app = createApp(parse(source), { files: { 'users.csv': seed } });
    const res = app.request({ method: 'GET', path: '/users/2' });
    expect(res.logs.some(l => l.includes('2'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Memory API pattern
// ---------------------------------------------------------------------------

describe('mock-api — memory API pattern', () => {
  const source = `
@App
name = Memory Test
type = REST

@Route/GET /items
run:
    items = memory.get items
    respond 200 items

@Route/POST /items
run:
    parse-json
    items = memory.get items
    items.push(body)
    memory.set items items
    respond 200 items
`;

  it('GET /items returns seeded memory items', () => {
    const app = createApp(parse(source), { memory: { items: ['a', 'b'] } });
    const res = app.request({ method: 'GET', path: '/items' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(['a', 'b']);
  });
});
