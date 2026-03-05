# Lambda Runner Feature – User Stories

## Story 1: Package VectRune for Lambda Execution
- **As a** platform engineer
- **I want** a CLI command (`vectrune lambda package`) that bundles the runtime binary, Rune sources, and config into a Lambda-ready artifact (zip or container image)
- **So that** I can ship VectRune APIs to AWS Lambda without manual assembly.
- **Acceptance Criteria**:
  - CLI accepts rune path, output path, and mode (`zip`/`container`).
  - Produced artifact embeds version metadata and manifest of included files.
  - Packaging fails fast with actionable errors for oversized zips (>50 MB) and missing inputs.
- **Implementation Details**:
  - Implemented a CLI subcommand `vectrune lambda package` that takes `--rune-path`, `--output`, and `--mode` arguments.
  - The command collects the VectRune binary, specified Rune files, and configuration, and packages them into a zip file or container image as requested.
  - The package includes a manifest file with version and file list, and embeds the current VectRune version from Cargo metadata.
  - The CLI checks the final zip size and fails with a clear error if it exceeds 50 MB, or if any required input is missing.
  - Errors are surfaced with actionable messages for CI and developer use.

## Story 2: Lambda Handler & Event Adapter
- **As a** runtime engineer
- **I want** a Lambda runner binary that initializes VectRune once per container and maps Lambda events (API Gateway HTTP + direct invokes) into Rune REST/GraphQL requests
- **So that** incoming traffic is correctly processed inside Lambda.
- **Acceptance Criteria**:
  - Handler uses `lambda_runtime` crate, supports `VECTRUNE_RUN_MODE`, `VECTRUNE_RUNE_PATH`, and optional S3 source env vars.
  - API Gateway HTTP v2 events convert to VectRune REST context; direct invoke payloads follow documented contract.
  - Structured logs (JSON) emitted with request id, level, and message.
- **Implementation Details**:
  - The Lambda handler is implemented using the `lambda_runtime` crate and initializes the VectRune runtime and router once per cold start.
  - The handler reads the Rune file path from the `RUNE_FILE` environment variable (aliased to `VECTRUNE_RUNE_PATH`), and supports additional env vars for run mode and S3 source.
  - On cold start, the handler loads and parses the Rune file, builds the router, and caches both in static state for warm invocations.
  - Lambda API Gateway HTTP v2 events are mapped to Axum HTTP requests and routed through the VectRune REST or GraphQL router.
  - If the Rune file is missing or invalid, or the App type is not supported, the handler returns a 500 error with a clear message for all requests.
  - All errors and requests are logged in structured JSON format, including request id, log level, and message, to facilitate debugging and observability in Lambda logs.
  - Integration tests verify correct error handling, event mapping, and cold start behavior.

## Story 3: Memory & Configuration Accessibility
- **As a** Rune author
- **I want** shared memory initialization and configuration hooks accessible to both REST and GraphQL modules in Lambda
- **So that** my Rune documents behave the same locally and in Lambda.
- **Acceptance Criteria**:
  - Memory builtins initialize during cold start and persist for warm invocations (with pluggable backends when persistence required).
  - In-memory backend is default; persistence across cold starts is possible via pluggable backends (e.g., DynamoDB, S3, Redis), configurable via environment variables or the Rune file.
  - Environment variables control log level, rune source, cache TTL, and memory backend selection; all defaults are documented.
  - Configuration can be set in the Rune file and overridden by environment variables.
  - Errors from initialization (e.g., backend connection failure) propagate as Lambda failures with clear, structured logs.
  - All logs and errors are structured as JSON for easy debugging in AWS CloudWatch and local logs.
  - Integration tests verify local and Lambda behavior for in-memory and external backends, including error propagation and logging.
- **Implementation Details**:
  - Memory backend is selected via `VECTRUNE_MEMORY_BACKEND` env var (`memory`, `dynamodb`, `s3`, etc.).
  - Cache TTL and log level are set via `VECTRUNE_CACHE_TTL` and `VECTRUNE_LOG_LEVEL`.
  - On cold start, the backend is initialized and a health check is performed; failures abort startup with a clear error.
  - If using an external backend, credentials and region are read from environment or IAM role.
  - All configuration options and defaults are documented in the README and Lambda usage guide.

### What has been completed so far
- Refactored the memory backend system to be async, globally initialized, and pluggable (in-memory, future DynamoDB/S3/Redis).
- Updated memory builtins and runtime to support async, global, and environment-configurable memory backends.
- Ensured the memory backend is initialized at cold start and accessible to all modules (REST, GraphQL, etc.).
- Validated that the memory backend can be configured via environment variables and is ready for Lambda cold start and multi-invocation scenarios.

### Subtasks (to be tackled next)
- [ ] Lambda handler implementation using `lambda_runtime` crate.
- [ ] REST/GraphQL adapter layer for Lambda event translation.
- [ ] CLI packaging and deployment automation.
- [ ] Integration tests and validation in AWS Lambda/local stack.
- [ ] Documentation and deployment walkthroughs.
- [ ] Observability/logging improvements and metrics hooks.
- [ ] Pluggable persistent memory backends (DynamoDB, S3).

## Story 4: Documentation & Example Deployment
- **As a** developer onboarding to Lambda support
- **I want** a documented walkthrough (e.g., Book GraphQL API) plus deployment instructions
- **So that** I can reproduce the setup and validate functionality end-to-end.
- **Acceptance Criteria**:
  - New example under `examples/lambda/book_graphql_lambda/` runnable locally and via Lambda, exposing both REST and GraphQL endpoints to demonstrate parity.
  - README/Lambda guide covers packaging, deployment (zip + container), environment variables, and troubleshooting.
  - CI or manual checklist ensures the example passes integration tests before release.

## Story 5: Deploy VectRune to AWS Lambda (with API Gateway via AWS SAM)
- **As a** DevOps engineer
- **I want** to deploy a packaged VectRune Lambda artifact directly to AWS Lambda using available AWS credentials in the environment, with an API Gateway created automatically
- **So that** I can automate deployment and updates without leaving the CLI or writing custom scripts, and expose my API securely.
- **Acceptance Criteria**:
  - CLI command (`vectrune --aws "rune_file_name.rune" --cloud-formation-stack "Stack-Name" [--s3-bucket my-bucket]`) deploys the artifact using AWS SAM and environment credentials.
  - The CLI generates a SAM template by default, which creates the Lambda function and an API Gateway endpoint mapped to it.
  - If the artifact is larger than 10 MB, the CLI uploads it to the specified S3 bucket and references it in the SAM/CloudFormation template.
  - Supports specifying function name, region, memory, timeout, and environment variables.
  - Handles function creation, update, and publishes a new version/alias as needed.
  - Provides clear output and actionable errors for missing credentials, permissions, or AWS API failures.
  - Fails with a clear error if a large artifact is detected and no S3 bucket is provided.
  - Optionally integrates with AWS S3 for large artifacts and supports IAM role configuration.
- **Implementation Details**:
  - The CLI uses the AWS SDK for Rust to authenticate using environment credentials (e.g., `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, or IAM role).
  - The deploy command generates a SAM template (YAML) that defines the Lambda function and an API Gateway endpoint (ANY /{proxy+}).
  - The deploy command accepts arguments for function name, region, runtime, memory, timeout, env vars, and S3 bucket, and uploads the artifact as needed.
  - If the function does not exist, it is created; if it exists, the code is updated and a new version is published.
  - For large artifacts, the CLI uploads to S3 and references the S3 object in the Lambda or CloudFormation update.
  - All deployment steps are logged with clear progress and error messages.
  - Integration tests or dry-run mode verify deployment logic without making changes.
  - Users can optionally output the generated SAM template for manual deployment or CI/CD integration.
  - Example SAM template:
    ```yaml
    AWSTemplateFormatVersion: '2010-09-09'
    Transform: AWS::Serverless-2016-10-31
    Resources:
      VectruneFunction:
        Type: AWS::Serverless::Function
        Properties:
          Handler: bootstrap
          Runtime: provided.al2
          CodeUri: ./dist/
          MemorySize: 512
          Timeout: 30
          Events:
            Api:
              Type: Api
              Properties:
                Path: /{proxy+}
                Method: ANY
    Outputs:
      ApiUrl:
        Description: "API Gateway endpoint URL"
        Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/"
    ```
