# Task 1 – Lambda Packaging Feature: Next Steps

Status: Core implementation landed (`vectrune lambda package`) with unit tests and CLI wiring. Artifacts include zip bundles with manifest metadata and container-context tarballs.

## Open Follow-ups
1. **Developer Experience**
   - Document usage examples in `README.md` (flags, default paths, common errors).
   - Provide sample invocation scripts for both zip and container modes.
2. **Binary Provenance**
   - Clarify expected binary target (static Linux build) and add guidance for cross-compilation (`cargo build --target x86_64-unknown-linux-musl`).
   - Optionally offer an automated `--binary` default that builds into `dist/` when not supplied.
3. **Packaging Validation**
   - Add integration test that runs `vectrune lambda package` end-to-end on a fixture rune project.
   - Consider checksum output for produced archives to aid release pipelines.
4. **Configurability**
   - Support including additional asset directories (e.g., `assets/`, `schemas/`) via CLI flags.
   - Allow manifest overrides (custom metadata fields) for enterprise workflows.
5. **Distribution Hooks**
   - Add `vectrune lambda publish` placeholder for pushing container images or uploading zips to S3.
   - Provide GitHub Action example for invoking the packaging command in CI.

## Blockers / Questions
- ✅ Binary sourcing remains manual for now; users must pass an explicit Lambda-compatible binary path.
- ✅ Windows packaging is out-of-scope—focus on Linux artifacts compatible with AWS Lambda.

## Recommendation Before Task 2
- With the binary decision locked in, Task 2 can concentrate on improving the Linux build story (cross-compilation guidance, verification) without rehashing requirements.
