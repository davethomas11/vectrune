# Lambda Runner Contract

## 1. Entry Point Contract
- **Lambda Handler Signature**: `vectrune_lambda::run(event: LambdaEvent<Value>) -> Result<Value>`
- **Supported Events**:
  - API Gateway HTTP (v2)
  - Direct invoke with custom payload `{ "rune_file": "", "action": "rest|graphql", "input": {...} }`
- **Environment Variables**:
  - `VECTRUNE_RUN_MODE` (`rest`, `graphql`, `auto`)
  - `VECTRUNE_RUNE_PATH` (default `rune/app.rune` inside bundle)
  - `VECTRUNE_LOG_LEVEL` (`error|warn|info|debug|trace`)
  - `VECTRUNE_S3_BUCKET` + `VECTRUNE_S3_KEY` (optional remote rune source)

## 2. Packaging Layout
```
/var/task/
  bootstrap (lambda runner binary)
  rune/
    app.rune
    config.yaml (optional)
  config/
    runtime.toml
```
- Zip artifact must remain < 50 MB uncompressed; otherwise require container image delivery.

## 3. Runtime Behavior
1. **Initialization Phase**
   - Load Rune document from local path; if env indicates S3, fetch and cache in `/tmp/vectrune-cache`.
   - Initialize shared memory + builtins once per container lifecycle (cold start) and store in static global accessible to REST + GraphQL modules.
2. **Invocation Phase**
   - Parse Lambda event into `VectRuneRequest` (REST or GraphQL) using adapter library.
   - Execute corresponding Rune entrypoint; surface return value or errors as Lambda JSON response.
   - Attach request/trace ids to log context for CloudWatch correlation.
3. **Error Handling**
   - Validation errors return HTTP 400 payload when invoked via API Gateway; otherwise return `"error": { message, kind }` JSON.
   - Runtime panics converted to 500 with stack trace logged (not included in response body by default).

## 4. CLI/Tooling Requirements
- `vectrune lambda package`
  - Inputs: `--rune app.rune`, `--output dist/`, `--mode zip|container`.
  - Outputs: zip file named `vectrune-lambda-<version>.zip` or OCI image tag.
- `vectrune lambda deploy`
  - Optional helper; shell out to AWS SAM/CLI with prepared template.
- CLI must write manifest describing packaged files (used for future diffs).

## 5. Testing Contract
- Provide integration test harness using `cargo lambda watch` or LocalStack that:
  - Invokes REST endpoint and asserts response matches local execution.
  - Runs book GraphQL mutation example, verifying arithmetic and object creation pipelines.
- Contract requires CI job to run `cargo lambda test` for critical examples before publishing release.

## 6. Observability
- Logs must use structured JSON lines with fields: `level`, `ts`, `request_id`, `message`, `context`.
- Metrics hook placeholder: allow optional CloudWatch EMF payload or `stdout` marker for later integration.

## 7. Versioning & Compatibility
- Runner version tracked via `VectRuneRuntime::version()` and embedded in Lambda metadata.
- Breaking contract changes require README + changelog updates plus semantic version bump.
