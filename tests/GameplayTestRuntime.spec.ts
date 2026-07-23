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

  it("makes moving Warriors ignore each other until their move orders finish or are blocked", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-auto-march", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const movementStats = {
      hp: 100,
      damage: 10,
      rangeCells: 1,
      fireCooldownFrames: 30,
      movementFramesPerCell: 10,
    };
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "marching-player",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.playerStart,
      stats: movementStats,
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "marching-enemy",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.enemyStart,
      stats: { ...movementStats, damage: 4, fireCooldownFrames: 60 },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "marching-player",
      order: { type: "move", destination: started.value.landmarks.playerDestination },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "marching-enemy",
      order: { type: "move", destination: started.value.landmarks.enemyDestination },
    })).toMatchObject({ ok: true });

    const result = runtime.advanceTestFrames(started.value.id, 30);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "unit.entered-cell",
      unitId: "marching-player",
    }));
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "unit.entered-cell",
      unitId: "marching-enemy",
    }));
    expect(result.value.events.filter((event) => event.type === "attack.committed")).toHaveLength(0);
    expect(result.value.events.filter((event) => event.type === "damage.applied")).toHaveLength(0);
  });

  it("makes a move order ignore an adjacent enemy while its route remains active", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-auto-move", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "moving-attacker",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.attackerStart,
      stats: { hp: 100, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 10 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "stationary-defender",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.defender,
      stats: { hp: 100 },
    })).toMatchObject({ ok: true });
    const moveOrder = runtime.issueTestOrder({
      unitId: "moving-attacker",
      order: { type: "move", destination: started.value.landmarks.destination },
    });
    expect(moveOrder).toMatchObject({ ok: true, value: { type: "move", status: "running" } });

    const result = runtime.advanceTestFrames(started.value.id, 30);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "unit.entered-cell",
      unitId: "moving-attacker",
      to: { col: 3, row: 0 },
    }));
    expect(result.value.events.filter((event) => event.type === "attack.committed")).toHaveLength(0);
    expect(result.value.orders.find((order) => order.unitId === "moving-attacker")).toMatchObject({
      type: "move",
    });

    const afterMove = runtime.advanceTestFrames(started.value.id, 30);
    expect(afterMove).toMatchObject({ ok: true });
    if (!afterMove.ok) return;
    expect(afterMove.value.events).toContainEqual(expect.objectContaining({
      type: "attack.committed",
      unitId: "moving-attacker",
      targetId: "stationary-defender",
      reason: "melee",
    }));
  });

  it("makes a holding Warrior attack an approaching enemy without changing cells", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-hold-attack", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "holding-defender",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.defender,
      stats: { hp: 100, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "advancing-enemy",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.attackerStart,
      stats: { hp: 100, damage: 4, rangeCells: 1, fireCooldownFrames: 60, movementFramesPerCell: 10 },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "holding-defender",
      order: { type: "hold-position" },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "advancing-enemy",
      order: { type: "move", destination: started.value.landmarks.attackerDestination },
    })).toMatchObject({ ok: true });

    const result = runtime.advanceTestFrames(started.value.id, 60);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.events.some((event) => (
      event.type === "unit.entered-cell" && event.unitId === "holding-defender"
    ))).toBe(false);
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "unit.entered-cell",
      unitId: "advancing-enemy",
      to: { col: 2, row: 0 },
    }));
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "damage.applied",
      sourceId: "holding-defender",
      targetId: "advancing-enemy",
    }));
    expect(result.value.orders.find((order) => order.unitId === "holding-defender")).toMatchObject({
      type: "hold-position",
      status: "running",
    });
  });

  it("keeps a holding Warrior in its square cell while it attacks a passing enemy", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-hold-square", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "square-holder",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.defender,
      stats: { hp: 100, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "square-passer",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.attackerStart,
      stats: { hp: 100, damage: 4, rangeCells: 1, fireCooldownFrames: 60, movementFramesPerCell: 10 },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "square-holder",
      order: { type: "hold-position" },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "square-passer",
      order: { type: "move", destination: started.value.landmarks.attackerDestination },
    })).toMatchObject({ ok: true });

    const result = runtime.advanceTestFrames(started.value.id, 80);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.events.some((event) => (
      event.type === "unit.entered-cell" && event.unitId === "square-holder"
    ))).toBe(false);
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "unit.entered-cell",
      unitId: "square-passer",
      to: { col: 3, row: 4 },
    }));
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "damage.applied",
      sourceId: "square-holder",
      targetId: "square-passer",
    }));
    expect(result.value.units.find((unit) => unit.id === "square-holder")?.cell).toEqual(
      started.value.landmarks.defender,
    );
  });

  it("makes an unordered Warrior pursue and attack the closest enemy in a square scenario", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-pursuit-square", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "free-pursuer",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.pursuer,
      stats: { hp: 100, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 8 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "stationary-target",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.runnerStart,
      stats: { hp: 100 },
    })).toMatchObject({ ok: true });

    const result = runtime.advanceTestFrames(started.value.id, 80);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "unit.entered-cell",
      unitId: "free-pursuer",
    }));
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "target.acquired",
      unitId: "free-pursuer",
      targetId: "stationary-target",
    }));
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "damage.applied",
      sourceId: "free-pursuer",
      targetId: "stationary-target",
    }));
    expect(result.value.units.find((unit) => unit.id === "free-pursuer")?.order).toBeNull();
  });

  it("pauses an attack-move order to defeat a visible enemy and then resumes its destination", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-pursuit-square", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "attack-mover",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.pursuer,
      stats: { hp: 100, damage: 100, rangeCells: 1, fireCooldownFrames: 1, movementFramesPerCell: 8 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "route-guard",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.runnerStart,
      stats: { hp: 100 },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "attack-mover",
      order: { type: "attack-move", destination: started.value.landmarks.runnerDestination },
    })).toMatchObject({ ok: true });

    const result = runtime.advanceTestFrames(started.value.id, 160);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "damage.applied",
      sourceId: "attack-mover",
      targetId: "route-guard",
    }));
    expect(result.value.units.find((unit) => unit.id === "attack-mover")?.cell).toEqual(
      started.value.landmarks.runnerDestination,
    );
    expect(result.value.orders.find((order) => order.unitId === "attack-mover")).toMatchObject({
      type: "attack-move",
      status: "completed",
    });
  });

  it("keeps an attack-moving Warrior progressing forward while its target changes cells", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-auto-march", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const stats = { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 60 };
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "forward-player",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.playerStart,
      stats,
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "forward-enemy",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.enemyStart,
      stats,
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "forward-player",
      order: { type: "attack-move", destination: started.value.landmarks.playerDestination },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "forward-enemy",
      order: { type: "attack-move", destination: started.value.landmarks.enemyDestination },
    })).toMatchObject({ ok: true });

    let previousX = -Infinity;
    for (let frame = 0; frame < 180; frame += 1) {
      expect(runtime.advanceTestFrames(started.value.id, 1)).toMatchObject({ ok: true });
      const player = runtime.getScenarioSnapshot(started.value.id).units.find((unit) => unit.id === "forward-player");
      expect(player?.world.x).toBeGreaterThanOrEqual(previousX);
      previousX = player?.world.x ?? previousX;
    }
  });

  it("keeps a patrol order active while the Warrior automatically attacks a nearby target", () => {
    const runtime = createRuntime();
    const started = runtime.beginScenario({ preset: "warrior-patrol-square", simulation: "manual" });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "patrolling-warrior",
      archetype: "warrior",
      team: "player",
      cell: started.value.landmarks.patrolStart,
      stats: { hp: 100, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: 10 },
    })).toMatchObject({ ok: true });
    expect(runtime.spawnTestUnit({
      scenarioId: started.value.id,
      id: "patrol-target",
      archetype: "warrior",
      team: "enemy",
      cell: started.value.landmarks.target,
      stats: { hp: 100 },
    })).toMatchObject({ ok: true });
    expect(runtime.issueTestOrder({
      unitId: "patrolling-warrior",
      order: {
        type: "patrol",
        endpoints: [started.value.landmarks.patrolStart, started.value.landmarks.patrolEnd],
      },
    })).toMatchObject({ ok: true });

    const result = runtime.advanceTestFrames(started.value.id, 80);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "unit.entered-cell",
      unitId: "patrolling-warrior",
      to: { col: 3, row: 2 },
    }));
    expect(result.value.events).toContainEqual(expect.objectContaining({
      type: "damage.applied",
      sourceId: "patrolling-warrior",
      targetId: "patrol-target",
    }));
    expect(result.value.orders.find((order) => order.unitId === "patrolling-warrior")).toMatchObject({
      type: "patrol",
      status: "running",
    });
  });
});
