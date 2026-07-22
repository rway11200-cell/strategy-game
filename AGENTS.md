# Tower Defence Pixi

Project instructions for coding agents.

## Workflow

- El desarrollo se realiza en la rama `develop`.
- Al iniciar cada nueva feature, hacer `git pull origin main` en `develop` para mantenerla actualizada con `main`.
- Usar `codebase-memory-mcp` para explorar, comprender y analizar el impacto de los cambios en el código antes de modificarlo.

## Playwright Tests

When creating or changing tests under `tests/playwright/`, design the desired product behavior first. Do not limit the test to methods or observability that happen to exist in the current implementation.

### Contract-First Workflow

- Write the clearest final behavioral test, then derive the testing API required to support it.
- Add missing contracts to the canonical testing API in `src/app/testing/GameTestApi.ts`. Do not declare ad-hoc API interfaces or use `as unknown as SomeTestApi` inside individual specs.
- Import snapshots, orders, events, and result types from the canonical testing API. Do not duplicate their structures in specs or drivers.
- A future API method may temporarily use a typed `notImplemented()` stub. TypeScript and ESLint must still pass; Playwright may fail at runtime with an explicit `GameTestApi.<method> is not implemented` error until the behavior is implemented.
- Stubs are acceptable only during an explicitly requested contract-first/TDD phase. Do not leave a stub as the final implementation, hide it with `test.skip`, or treat an intentionally failing suite as completed behavior.
- Do not weaken assertions, add arbitrary waits, or adapt the story to make an incomplete implementation pass.
- Reuse `tests/playwright/support/GameTestDriver.ts` and `GameTestFixture.ts`. Extend the shared driver instead of duplicating `page.evaluate`, readiness helpers, result unwrapping, or cleanup logic.
- Drivers handle browser transport, `ApiResult` unwrapping, scenario registration, and cleanup. Behavioral expectations belong in specs, not drivers.

### Test Structure

- Use `test.step` to express a readable Given / When / Then narrative.
- Give scenarios and entities semantic names such as `attacker`, `closerAlly`, `checkpoint`, `pointA`, and `base`.
- Prefer one explicit behavior per test. Keep movement, combat policy, collision fairness, visual rendering, and deployment health separate unless their interaction is the behavior under test.
- Assertions must prove causality, not merely a changed value. For example, verify target acquisition, projectile or damage events, source and target IDs, and the resulting health.
- Include a positive control when asserting that something does not happen. A friendly-fire test must also prove that the attacker can and does damage a hostile target.
- Generalize that rule to every negative assertion: prove the system was active and capable of producing the prohibited behavior.
- Use stable unit, order, wave, and event IDs. Never identify entities by array position, pixel coordinates, or current cell when an ID can exist.
- Do not keep empty specs or tombstone comments for removed tests. Delete the file or restore a meaningful behavioral test.

### Determinism And Isolation

- Gameplay E2E tests must run in named, isolated scenarios with the production timeline disabled and a manual simulation clock.
- Prefer fixed scenario landmarks over searching the production map for the first free cell.
- Do not use `waitForLoadState("networkidle")` as game readiness. Use a public, purpose-built readiness signal.
- Advance simulation through deterministic frame or event APIs such as `advanceTestSimulation`; do not use `waitForTimeout`, busy-wait `tick(ms)`, wall-clock timing, or polling callbacks that mutate state.
- Observe logical grid cells and domain events. Do not infer gameplay state with `Math.floor(worldX / tileSize)` or canvas pixels.
- Read related units, orders, cells, events, economy, waves, and errors from one atomic scenario snapshot whenever a consistency assertion spans them.
- Events used for causality must include a monotonic `sequence`, simulation `frame`, `scenarioId`, and relevant source/target/entity IDs.
- A final snapshot does not prove an invariant held throughout a simulation. Use ordered events or snapshots at each committed transition.
- Cleanup must run through the shared fixture even when an assertion fails. Cleanup should verify no remaining test units, commands, projectiles, timers, or leaked occupations.

### Behavioral Contracts

- Commands must be issued by unit ID and return an identifiable order snapshot with status and history.
- A replaced command must be observable as `cancelled`, not silently disappear or look naturally completed.
- Movement tests should verify cell transitions, previous-cell release, destination occupation, and absence of residual movement.
- Patrol tests should verify ordered transitions, endpoint visits, cycle count, continuity of the same order ID, and occupation consistency.
- Collision tests must distinguish safety from liveness: prove both no overlapping occupation and eventual progress or recovery from every temporary block.
- Death tests must distinguish damage, death, occupation release, and despawn. Prove a released cell is actually reusable.
- Wave tests must follow stable unit IDs through the configured path and prove wave completion, not merely that positions changed.
- `errors` assertions are useful only when the API records real structured lifecycle errors; do not rely on a hardcoded empty array as proof of correctness.

### Suite Boundaries

- Gameplay tests use `GameTestApi`, `GameTestDriver`, isolated scenarios, snapshots, and domain events.
- Gameplay specs enter through `GameTestDriver.open()` and the test-only `/__test__/gameplay/` harness. Do not navigate gameplay specs to `/` or boot `MainScreen` and the production timeline.
- Visual tests use the dedicated `GridVisualTestApi` or another compiled visual harness, a fixed viewport/DPR, semantic render snapshots, and locator screenshots. Gameplay state APIs do not replace visual assertions.
- Grid visual specs use the test-only `/__test__/grid-renderer/` harness and must not boot gameplay.
- Production smoke tests must use public, read-only readiness signals such as `/health/ready` and stable DOM markers. Never require a mutable gameplay testing API in production.
- Test harness entries are isolated composition roots and may be deployed at `/__test__/gameplay/` and `/__test__/grid-renderer/`. They must never be imported by `src/main.ts` or alter the `/` boot path.
- Do not use broad console-error allowlists that hide missing assets, failed fetches, texture failures, or application exceptions. Capture page errors, first-party request failures, and HTTP errors explicitly.

### Verification

After editing Playwright tests or their contracts, run at minimum:

```sh
npx tsc --noEmit
npx tsc --noEmit -p tests/playwright/tsconfig.json
npx eslint src/app/testing tests/playwright
git diff --check
```

Also execute every changed spec, or at minimum a representative spec while the contract is intentionally stubbed:

```sh
npx playwright test tests/playwright/<spec>.spec.ts --reporter=list
```

When future methods are still stubbed, confirm the test reaches the intended `not implemented` boundary rather than failing during boot, navigation, typing, or setup. Report that intentional runtime failure explicitly; do not describe the behavior as implemented or passing.
