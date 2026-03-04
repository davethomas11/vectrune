# Lambda Runner Feature – User Stories

## Story 1: Package VectRune for Lambda Execution
- **As a** platform engineer
- **I want** a CLI command (`vectrune lambda package`) that bundles the runtime binary, Rune sources, and config into a Lambda-ready artifact (zip or container image)
- **So that** I can ship VectRune APIs to AWS Lambda without manual assembly.
- **Acceptance Criteria**:
  - CLI accepts rune path, output path, and mode (`zip`/`container`).
  - Produced artifact embeds version metadata and manifest of included files.
  - Packaging fails fast with actionable errors for oversized zips (>50 MB) and missing inputs.

## Story 2: Lambda Handler & Event Adapter
- **As a** runtime engineer
- **I want** a Lambda runner binary that initializes VectRune once per container and maps Lambda events (API Gateway HTTP + direct invokes) into Rune REST/GraphQL requests
- **So that** incoming traffic is correctly processed inside Lambda.
- **Acceptance Criteria**:
  - Handler uses `lambda_runtime` crate, supports `VECTRUNE_RUN_MODE`, `VECTRUNE_RUNE_PATH`, and optional S3 source env vars.
  - API Gateway HTTP v2 events convert to VectRune REST context; direct invoke payloads follow documented contract.
  - Structured logs (JSON) emitted with request id, level, and message.

## Story 3: Memory & Configuration Accessibility
- **As a** Rune author
- **I want** shared memory initialization and configuration hooks accessible to both REST and GraphQL modules in Lambda
- **So that** my Rune documents behave the same locally and in Lambda.
- **Acceptance Criteria**:
  - Memory builtins initialize during cold start and persist for warm invocations (with pluggable backends when persistence required).
  - Environment variables control log level, rune source, and cache TTL; defaults documented.
  - Errors from initialization propagate as Lambda failures with clear logs.

## Story 4: Documentation & Example Deployment
- **As a** developer onboarding to Lambda support
- **I want** a documented walkthrough (e.g., Book GraphQL API) plus deployment instructions
- **So that** I can reproduce the setup and validate functionality end-to-end.
- **Acceptance Criteria**:
  - New example under `examples/lambda/book_graphql_lambda/` runnable locally and via Lambda, exposing both REST and GraphQL endpoints to demonstrate parity.
  - README/Lambda guide covers packaging, deployment (zip + container), environment variables, and troubleshooting.
  - CI or manual checklist ensures the example passes integration tests before release.
