import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse, createApp, toDocument } from '../src/index';

const source = readFileSync(new URL('../../../examples/book_graphql.rune', import.meta.url), 'utf8');
const makeApp = () => createApp(parse(source));

describe('GraphQL execution', () => {
  it('executes the repository example and returns only selected fields', () => {
    const app = makeApp();
    expect(app.graphql({ query: '{ books { id title } authors { name } }' })).toMatchObject({
      status: 200,
      body: { data: {
        books: [{ id: 1, title: 'The Rust Programming Language' }, { id: 2, title: 'Programming WebAssembly with Rust' }],
        authors: [{ name: 'Steve Klabnik' }, { name: 'Kevin Hoffman' }],
      } },
    });
  });

  it('supports variables, aliases, fragments and directives', () => {
    expect(makeApp().graphql({
      query: 'query Find($id: Float!, $show: Boolean!) { first: book(id: $id) { ...BookFields } books @include(if: $show) { id } } fragment BookFields on Book { id title }',
      variables: { id: 2, show: false },
    })).toMatchObject({ status: 200, body: { data: { first: { id: 2, title: 'Programming WebAssembly with Rust' } } } });
  });

  it('executes mutations against shared memory and resets each new app', () => {
    const document = parse(source);
    const app = createApp(document);
    expect(app.graphql({
      query: 'mutation Add($title: String!) { addBook(title: $title, author_id: 1, published_year: 2026) { id title } }',
      variables: { title: 'A browser book' },
    })).toMatchObject({ status: 200, body: { data: { addBook: { id: 3, title: 'A browser book' } } } });
    expect(app.graphql({ query: '{ book(id: 3) { id title } }' })).toMatchObject({ body: { data: { book: { id: 3, title: 'A browser book' } } } });
    expect(app.memoryStore.books).toHaveLength(3);
    expect(createApp(document).memoryStore.books).toHaveLength(2);
    expect(document.rawSections['Memory/books'].record).toHaveLength(2);
  });

  it('validates queries and variables before running mutations', () => {
    const app = makeApp();
    const invalid = app.graphql({ query: 'mutation { addBook(title: "Bad", author_id: 1, published_year: 2026) { missingField } }' });
    expect(invalid).toMatchObject({ status: 400, body: { errors: [expect.objectContaining({ message: expect.stringContaining('missingField') })] } });
    expect(app.memoryStore.books).toHaveLength(2);
    expect(app.graphql({ query: 'query Find($id: Float!) { book(id: $id) { id } }' })).toMatchObject({ status: 400, body: { errors: expect.any(Array) } });
    expect(app.graphql({ query: 'query {' })).toMatchObject({ status: 400, body: { errors: expect.any(Array) } });
  });

  it('returns resolver errors with their GraphQL field path', () => {
    expect(makeApp().graphql({ query: '{ book(id: 999) { id } }' })).toMatchObject({
      status: 200, body: { data: null, errors: [expect.objectContaining({ path: ['book'] })] },
    });
  });

  it('supports named operations and POST /graphql requests', () => {
    const app = makeApp();
    const query = 'query A { books { id } } query B { author(id: 1) { name } }';
    expect(app.request({ method: 'POST', path: '/graphql', body: JSON.stringify({ query, operationName: 'B' }) }))
      .toMatchObject({ status: 200, body: { data: { author: { name: 'Steve Klabnik' } } } });
    expect(app.graphql({ query })).toMatchObject({ status: 400 });
    expect(app.request({ method: 'POST', path: '/graphql', body: '{broken' })).toMatchObject({ status: 400 });
  });

  it('supports @Type / @Query shorthand', () => {
    const app = createApp(parse(readFileSync(new URL('./fixtures/graphql-shorthand.rune', import.meta.url), 'utf8')));
    expect(app.graphql({ query: '{ books { title author } }' })).toMatchObject({ status: 200, body: { data: { books: [
      { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann' },
      { title: 'The Pragmatic Programmer', author: 'Andy Hunt & Dave Thomas' },
    ] } } });
  });

  it('keeps query and mutation resolver names independent and logs real execution', () => {
    const app = createApp(parse(`@Query/value -> string
run:
    log "Read resolver"
    return "read"
@Mutation/value -> string
run:
    return "written"
`));
    expect(app.graphql({ query: '{ value }' })).toMatchObject({ body: { data: { value: 'read' } }, logs: ['Read resolver'] });
    expect(app.graphql({ query: 'mutation { value }' })).toMatchObject({ body: { data: { value: 'written' } } });
  });

  it('generates executable examples from the declared schema and retains GraphQL document data', () => {
    const app = makeApp();
    const info = app.graphqlInfo();
    expect(info.schema).toContain('addBook(title: String!, author_id: Float!, published_year: Float!): Book!');
    expect(info.examples).toHaveLength(6);
    for (const example of info.examples) {
      const response = app.graphql(example);
      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('errors');
    }
    expect(toDocument(parse(source))).toHaveProperty('GraphQL.Query');
  });
});
