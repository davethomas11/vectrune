# Vectrune Lambda Error Handling

## Cold Start Behavior

- On Lambda cold start, Vectrune attempts to load and parse the specified Rune file.
- If the file is missing or cannot be parsed, all requests will return a 500 error with a clear message.
- If the App type is not `REST` or `GRAPHQL`, all requests will return a 500 error with an unsupported App type message.

## Example Error Responses

### Missing Rune file
```json
{
  "statusCode": 500,
  "headers": { "Content-Type": "application/json" },
  "body": "Vectrune Lambda failed to start: Failed to read rune file: No such file or directory (os error 2)"
}
```

### Unsupported App type
```json
{
  "statusCode": 500,
  "headers": { "Content-Type": "application/json" },
  "body": "Unsupported App type: ... Only REST and GRAPHQL are supported."
}
```

### Valid REST/GRAPHQL app, but no matching route
```json
{
  "statusCode": 404,
  "headers": {},
  "body": ""
}
```

## Debugging

- Check the `body` field in the Lambda response for error details.
- Ensure the Rune file is present and valid in the Lambda deployment package.
- Only `REST` and `GRAPHQL` App types are supported.
