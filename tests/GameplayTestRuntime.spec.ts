import { describe, expect, it } from "vitest";
import { GameplayTestRuntime } from "../src/app/testing/GameplayTestRuntime";

function createRuntime(): GameplayTestRuntime {
  return new GameplayTestRuntime("1.2.3", () => ({
    ready: true,
    surfaceCount: 1,
    width: 768,
    height: 1024,
    errors: [],
  }));
}

describe("GameplayTestRuntime", () => {
  it("exposes the ready renderer without creating a gameplay scenario", () => {
    expect(createRuntime().getBootSnapshot()).toEqual({
      lifecycle: "ready",
      version: "1.2.3",
      renderer: { surfaceCount: 1, width: 768, height: 1024 },
      errors: [],
    });
  });

  it("creates an isolated three-cell corridor and an atomic initial snapshot", () => {
    const runtime = createRuntime();
    const result = runtime.beginScenario({
      preset: "three-cell-patrol-corridor",
      simulation: "manual",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      preset: "three-cell-patrol-corridor",
      frame: 0,
      grid: { columns: 3, rows: 1, tileSize: 64 },
      landmarks: {
        start: { col: 0, row: 0 },
        intermediate: { col: 1, row: 0 },
        end: { col: 2, row: 0 },
      },
    });

    const snapshot = runtime.getScenarioSnapshot(result.value.id);
    expect(snapshot).toMatchObject({
      scenarioId: result.value.id,
      frame: 0,
      eventSequence: 1,
      economy: { coins: 0 },
      units: [],
      orders: [],
      wave: null,
      rules: { friendlyFire: false },
      errors: [],
    });
    expect(snapshot.cells).toHaveLength(3);
    expect(snapshot.cells.every((cell) => !cell.occupied && cell.occupantId === null)).toBe(true);
    expect(snapshot.events).toEqual([
      {
        sequence: 1,
        frame: 0,
        scenarioId: result.value.id,
        type: "scenario.started",
      },
    ]);
  });

  it("rejects overlapping scenarios and permits a new scenario after idempotent cleanup", () => {
    const runtime = createRuntime();
    const first = runtime.beginScenario({
      preset: "tower-placement",
      simulation: "manual",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(
      runtime.beginScenario({ preset: "three-cell-patrol-corridor", simulation: "manual" }),
    ).toMatchObject({ ok: false, error: { code: "SCENARIO_ACTIVE" } });

    expect(runtime.cleanupScenario(first.value.id)).toEqual({
      ok: true,
      value: {
        removedUnitIds: [],
        remainingTestUnitIds: [],
        leakedOccupations: [],
        pendingOrderIds: [],
        pendingProjectileIds: [],
      },
    });
    expect(runtime.cleanupScenario(first.value.id)).toMatchObject({ ok: true });
    expect(
      runtime.beginScenario({ preset: "three-cell-patrol-corridor", simulation: "manual" }),
    ).toMatchObject({ ok: true });
  });
});
