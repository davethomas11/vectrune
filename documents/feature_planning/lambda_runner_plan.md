# VectRune AWS Lambda Runner – Delivery Plan

## 1. Goals
- Allow VectRune applications (REST + GraphQL) to execute inside AWS Lambda with minimal user changes.
- Provide a deployment workflow that bundles Rune sources, runtime, and dependencies into a Lambda-compatible artifact or container image.
- Support invoking Rune entrypoints via API Gateway/Lambda integration (HTTP) and via direct Lambda invocations (event payloads).

## 2. Proposed Architecture
1. **Lambda Runner Binary**
   - Thin wrapper compiled with `--target x86_64-unknown-linux-gnu` (or provided as Lambda container image).
   - Initializes VectRune runtime, loads Rune document(s) from packaged assets or S3.
   - Routes Lambda event payloads into VectRune request context.
   - Emits structured logs to CloudWatch via standard output.
2. **Runtime Adapter Layer**
   - Translate API Gateway REST/HTTP events to VectRune REST request objects.
   - Provide bindings for Lambda context (request id, client certs, etc.) accessible within Rune.
   - Manage cold-start memory initialization and optional caching between invocations.
3. **Packaging Options**
   - **Zip-based Lambda**: Pre-built static binary + Rune bundle zipped under 50 MB.
   - **Container-based Lambda**: Publish OCI image with Ubuntu/Alpine base, VectRune runtime, and entrypoint.
4. **Deployment Tooling**
   - New CLI command `vectrune lambda package` to assemble artifact (binary + rune files + config).
   - Optional `vectrune lambda deploy` to push artifact to AWS (using SAM/Serverless/CDK integration hooks).

## 3. Implementation Phases
1. **Research & Spikes**
   - Validate binary compatibility with Lambda execution environment.
   - Prototype event translation for HTTP API (v2) payload.
2. **Core Runner Development**
   - Implement Lambda handler (Rust) using `lambda_runtime` crate.
   - Add runtime adapters for REST + GraphQL (reuse existing modules, ensure memory init accessible globally).
   - Support env-based configuration (Rune file path, logging level, warm-cache TTL).
3. **Tooling & Packaging**
   - Extend CLI with `lambda` subcommands.
   - Document bundling expectations (folder layout, config files).
4. **Testing & Validation**
   - Unit tests for event translation.
   - Integration tests using `cargo lambda` or local stack to emulate Lambda.
   - Manual deploy guide + sample project (e.g., book GraphQL API) deployed to Lambda.
5. **Docs & Examples**
   - Publish walkthrough in `examples/lambda/book_graphql_lambda/`.
   - Update README with Lambda support badges and quickstart.

## 4. Risks & Mitigations
- **Binary size**: Use `musl` + strip to fit zip limits; container path if larger.
- **Cold start latency**: Cache parsed Rune documents between invocations; allow preload from S3.
- **Stateful memory builtin**: Provide pluggable backing stores (DynamoDB/Memory) to persist across invocations.
- **Logging/observability**: Align with AWS structured logging; expose log level env var.

## 5. Success Criteria
- User can run `vectrune lambda package` and deploy resulting artifact to Lambda with documented steps.
- API Gateway event triggers Rune REST/GraphQL handlers correctly; book GraphQL example passes existing tests when run inside Lambda.
- Documentation published with architecture diagrams + contract.
