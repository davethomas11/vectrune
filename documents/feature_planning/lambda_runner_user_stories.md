# Lambda Runner User Stories

## Story 3: Lambda Runner for VectRune

### Description
As a developer, I want to deploy VectRune applications to AWS Lambda so that I can run REST and GraphQL APIs serverlessly with minimal configuration and operational overhead.

### What has been completed so far
- Designed and documented the Lambda runner architecture and contract.
- Implemented a pluggable memory backend system with async support and global initialization, allowing for future extension to DynamoDB, S3, or Redis.
- Refactored memory builtins and runtime to support async, global, and environment-configurable memory backends.
- Ensured the memory backend is initialized at cold start and accessible to all modules (REST, GraphQL, etc.).
- Validated that the memory backend can be configured via environment variables and is ready for Lambda cold start and multi-invocation scenarios.

### Subtasks (to be tackled next)
1. **Lambda Handler Implementation**
   - Implement the Lambda entrypoint using the `lambda_runtime` crate.
   - Translate API Gateway and direct Lambda events into VectRune requests.
2. **REST/GraphQL Adapter Layer**
   - Build adapters to convert Lambda events to REST/GraphQL requests for VectRune.
   - Ensure all context (headers, query params, etc.) is mapped correctly.
3. **Packaging & CLI Tooling**
   - Implement `vectrune lambda package` to bundle binary, rune files, and config.
   - Add manifest generation and validation.
4. **Deployment Automation**
   - Add optional `vectrune lambda deploy` command to automate deployment via AWS CLI/SAM.
5. **Testing & Validation**
   - Add integration tests using `cargo lambda` or LocalStack.
   - Validate book GraphQL example and REST APIs work as expected in Lambda.
6. **Documentation & Examples**
   - Write Lambda deployment walkthrough and update README.
   - Provide a sample project in `examples/lambda/book_graphql_lambda/`.
7. **Observability & Logging**
   - Ensure all logs are structured JSON and include request/trace IDs.
   - Add hooks for metrics and CloudWatch integration.
8. **Pluggable Memory Backends**
   - Implement DynamoDB and S3 memory backends for persistent state across invocations.
   - Add configuration and health checks for external backends.

---

These subtasks will be tackled in order, with each step validated by integration tests and documentation updates.
