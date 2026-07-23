import { Texture } from "pixi.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/utils/sprite", () => ({
  getFramesAseprite: () => ({
    textures: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
    totalMs: 400,
    frameMs: [100, 100, 100, 100],
  }),
}));

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
  beforeAll(() => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

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

  it("produces units from a Spawn Point as its manual frames advance", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "spawn-point-demo", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const completed = runtime.advanceTestFrames(started.value.id, 1 + 90 * 15);
    expect(completed).toMatchObject({ ok: true });
    if (!completed.ok) return;

    expect(completed.value.units).toHaveLength(15);
    expect(completed.value.events).toContainEqual(expect.objectContaining({
      type: "unit.produced",
      sourceId: "spawn-point",
      unitId: "spawn-point-unit-1",
    }));
    expect(completed.value.events).toContainEqual(expect.objectContaining({
      type: "production.blocked",
      sourceId: "spawn-point",
      reason: "no-adjacent-cell-free",
    }));
    expect(completed.value.cells.find((cell) => cell.cell.col === 0 && cell.cell.row === 0)).toMatchObject({
      type: "blocked",
      occupied: false,
    });

    const structureCells = completed.value.cells.filter(
      (cell) => cell.occupantId === "structure:spawn-point",
    );
    expect(structureCells).toHaveLength(9);
    const occupiedUnitCells = completed.value.cells.filter(
      (cell) => cell.occupantId?.startsWith("spawn-point-unit-"),
    );
    expect(occupiedUnitCells).toHaveLength(15);
    expect(new Set(occupiedUnitCells.map((cell) => cell.occupantId)).size).toBe(15);
    expect(new Set(occupiedUnitCells.map((cell) => `${cell.cell.col},${cell.cell.row}`)).size).toBe(15);
    for (const unit of completed.value.units) {
      expect(unit.occupiedCells).toEqual([unit.cell]);
    }

    expect(runtime.cleanupScenario(started.value.id)).toMatchObject({
      ok: true,
      value: { leakedOccupations: [] },
    });
  });

  it("spawns a player Warrior with the configured visual archetype", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-march", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "blue-warrior",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.origin,
    })).toMatchObject({
      ok: true,
      value: { id: "blue-warrior", archetype: "warrior", team: "player", active: true },
    });
  });

  it("applies Warrior melee damage at Attack1's impact and not before", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-duel", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "attacker",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.attacker,
      stats: { hp: 100, damage: 10, rangeCells: 1, fireCooldownFrames: 1 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "target",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.defender,
      stats: { hp: 100 },
    })).toMatchObject({ ok: true });

    const beforeImpact = runtime.advanceTestFrames(started.value.id, 12);
    expect(beforeImpact).toMatchObject({ ok: true });
    if (!beforeImpact.ok) return;
    expect(beforeImpact.value.events.filter((event) => event.type === "damage.applied")).toHaveLength(0);
    expect(beforeImpact.value.units.find((unit) => unit.id === "attacker")).toMatchObject({
      combat: { targetId: "target" },
    });

    const firstImpact = runtime.advanceTestFrames(started.value.id, 1);
    expect(firstImpact).toMatchObject({ ok: true });
    if (!firstImpact.ok) return;
    expect(firstImpact.value.events.filter((event) => event.type === "damage.applied")).toHaveLength(1);

    const beforeNextAnimation = runtime.advanceTestFrames(started.value.id, 24);
    expect(beforeNextAnimation).toMatchObject({ ok: true });
    if (!beforeNextAnimation.ok) return;
    expect(
      beforeNextAnimation.value.events
        .filter((event) => event.type === "damage.applied")
        .map((event) => event.frame),
    ).toEqual([13]);
  });

  it("releases a defeated Warrior cell before the deterministic death pof finishes", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-duel", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "attacker",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.attacker,
      stats: { hp: 100, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "defender",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.defender,
      stats: { hp: 20 },
    })).toMatchObject({ ok: true });

    const fatalHit = runtime.advanceTestFrames(started.value.id, 43);
    expect(fatalHit).toMatchObject({ ok: true });
    if (!fatalHit.ok) return;
    expect(fatalHit.value.events.filter((event) => event.type === "unit.died")).toEqual([
      expect.objectContaining({ unitId: "defender", frame: 43 }),
    ]);
    expect(fatalHit.value.cells.find((cell) => cell.cell.col === 1 && cell.cell.row === 0)).toMatchObject({
      occupied: false,
      occupantId: null,
    });
    expect(fatalHit.value.units.find((unit) => unit.id === "defender")).toMatchObject({
      lifecycle: "dead",
      active: true,
      hp: 0,
      occupiedCells: [],
    });

    const pofCompleted = runtime.advanceTestFrames(started.value.id, 14);
    expect(pofCompleted).toMatchObject({ ok: true });
    if (!pofCompleted.ok) return;
    expect(pofCompleted.value.units.find((unit) => unit.id === "defender")).toMatchObject({
      lifecycle: "dead",
      active: false,
    });
    expect(pofCompleted.value.events.filter((event) => event.type === "unit.died")).toHaveLength(1);
  });
});
