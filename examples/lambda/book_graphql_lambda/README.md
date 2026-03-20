# Book GraphQL API Example for Lambda Runner

This example demonstrates how to use VectRune to expose a Book API with GraphQL and REST endpoints, suitable for AWS Lambda deployment.

## Files
- `book_graphql_lambda.rune`: Rune document defining the API.
- `books.json`: Sample book data for memory backend.

## Usage

### Local
```
vectrune examples/lambda/book_graphql_lambda/book_graphql_lambda.rune --port 4000
```

### Lambda Packaging
```
vectrune lambda package --rune-path examples/lambda/book_graphql_lambda/book_graphql_lambda.rune --output dist/book_graphql_lambda.zip --mode zip
```

### Lambda Deployment (SAM CLI)
```
sam local start-api --template sam.yaml
```

## Endpoints
- `/graphql`: GraphQL endpoint for querying and mutating books.
- `/books`: REST endpoint for listing books.

## Example GraphQL Query
```
query {
  books {
    id
    title
    author_id
    published_year
  }
}
```

## Example GraphQL Mutation
```
mutation {
  addBook(title: "New Book", author_id: 2, published_year: 2026) {
    id
    title
    author_id
    published_year
  }
}
```

## Example REST Request
```
curl http://localhost:4000/books
```

## Notes
- Memory backend is used by default; can be configured for DynamoDB/S3 via env vars.
- See Lambda runner documentation for deployment details.

