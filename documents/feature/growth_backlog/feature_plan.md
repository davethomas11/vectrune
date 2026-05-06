# Growth Backlog Feature Plan

## Goal

Support Vectrune's path toward mass adoption while core language, runtime, and Rune-Web development continue.

This backlog is intentionally focused on adoption work that improves product learning, product trust, and product reuse.

## Success signals

Near-term signals to watch:
- a new user can get to a useful first result in 5 to 15 minutes
- the main README and starter examples are enough for a first successful workflow
- examples are increasingly reused as starting points instead of just demonstrations
- users can explain what Vectrune is for in one or two sentences
- fewer issues and questions are caused by setup confusion or unclear runtime behavior

## Priority buckets

### Now

1. **5-minute success path**
   - tighten the top of `README.md`
   - make install, run, and modify steps copyable
   - reduce branching choices in first-run docs

2. **Curated starter examples**
   - identify 3 to 5 official examples to recommend first
   - label each example by user goal and complexity
   - ensure each starter example has a short README or note

3. **Adoption-first docs shaping**
   - add or refine pages answering `Why Vectrune?`, `When should I use it?`, and `What should I build first?`
   - make docs flow from learn -> copy -> reference

4. **Developer trust improvements**
   - keep generated output readable
   - make runtime behavior easier to inspect and explain
   - improve error messages where confusion blocks adoption

### Next

1. **Starter templates**
   - REST starter
   - GraphQL starter
   - Rune-Web starter
   - Lambda starter

2. **Editor and environment polish**
   - strengthen VS Code support
   - strengthen IntelliJ support
   - improve syntax highlighting coverage and installation guidance

3. **Comparison and positioning docs**
   - explain where Vectrune fits well
   - compare it to adjacent tools in a factual way
   - clarify tradeoffs so users can self-select quickly

### Later

1. **Teaching site and guided learning**
   - staged tutorials
   - interactive learning paths
   - reusable lessons from curated examples

2. **Community growth loops**
   - issue templates focused on onboarding friction
   - contribution patterns for examples and templates
   - public writeups or walkthroughs built from stable examples

3. **Playground or instant-try experience**
   - browser-first exploration path
   - sharable examples
   - low-friction demo links

## Top initiatives

## Initiative: README first-run rewrite
- Problem: users may not understand the fastest path to success
- User: first-time evaluator
- Change: rewrite the opening README flow around one clear path
- Expected adoption impact: more users reach a useful result before dropping off
- Status: proposed

## Initiative: Official starter examples
- Problem: too many examples can make it unclear where to begin
- User: new user, evaluator, internal tool builder
- Change: promote a small official list with clear labels and outcomes
- Expected adoption impact: lower onboarding friction and higher example reuse
- Status: proposed

## Initiative: Trust surfaces
- Problem: declarative tools lose adoption when users cannot predict behavior
- User: technical evaluator or team lead
- Change: improve visibility into generated docs, runtime behavior, and safe defaults
- Expected adoption impact: higher trust and easier approval for real usage
- Status: proposed

## Dependencies

- stable examples under `examples/`
- current knowledge source under `knowledge/`
- CLI workflows that are simple enough to document clearly
- editor tooling maturity for common local development paths

## Out of scope for this backlog

- broad social media planning
- ecosystem partnerships
- growth experiments disconnected from product clarity
- marketing claims not backed by a real product workflow

