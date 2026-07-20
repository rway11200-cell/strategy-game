import { Container, Texture, type Ticker } from "pixi.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/utils/sprite", () => ({
  getFramesAseprite: () => ({ textures: [Texture.EMPTY], totalMs: 0, frameMs: [0] }),
}));

import { UnitCreator } from "../src/app/core/UnitCreator";
import {
  AttackCommand,
  HoldPositionCommand,
  MoveCommand,
  PatrolCommand,
  StopCommand,
} from "../src/app/core/UnitCommands";
import { Projectile } from "../src/app/core/unidades/Projectile";
import { type ShootOptions, Unit } from "../src/app/core/unidades/Unit";
import { createGridConfig, gridToWorld } from "../src/grid/GridConfig";
import { GridState } from "../src/grid/GridState";

const gridConfig = createGridConfig({ gridWidth: 8, gridHeight: 4, cellSize: 64 });

function ticker(lastTime: number): Ticker {
  return { lastTime, deltaTime: 1 } as Ticker;
}

function createUnit(
  container: Container,
  gridState: GridState,
  col: number,
  row: number,
  shootOptions?: ShootOptions,
  ticksPerCell = 1,
): Unit {
  const unit = new Unit(container, {
    framesJson: { idle: "unit.json" },
    health: 100,
    shootOptions,
  });
  unit.initializeTileMovement({
    cells: [],
    gridConfig,
    gridState,
    start: { col, row },
    entityType: "goblin",
    ticksPerCell,
  });
  unit.spawn();
  return unit;
}

describe("unit commands", () => {
  let container: Container;
  let gridState: GridState;

  beforeAll(() => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    container = new Container();
    gridState = new GridState(gridConfig);
  });

  it("pathfinds to a destination and keeps the destination occupied", () => {
    const unit = createUnit(container, gridState, 0, 0);

    unit.issueCommand(new MoveCommand({ col: 2, row: 0 }));
    unit.update(ticker(1));
    unit.update(ticker(2));

    expect(unit.getGridCell(gridConfig)).toEqual({ col: 2, row: 0 });
    expect(gridState.getCell({ col: 0, row: 0 })?.occupied).toBe(false);
    expect(gridState.getCell({ col: 2, row: 0 })?.occupantId).toBe(unit.getId());
    expect(unit.currentCommand).toBeUndefined();
  });

  it("keeps constant velocity through an intermediate cell", () => {
    const unit = createUnit(container, gridState, 0, 0, undefined, 4);
    const positions = [unit.position.x];
    let intermediateCell: ReturnType<Unit["getGridCell"]> = undefined;

    unit.issueCommand(new MoveCommand({ col: 2, row: 0 }));
    for (let frame = 1; frame <= 8; frame++) {
      unit.update(ticker(frame));
      positions.push(unit.position.x);
      if (frame === 4) intermediateCell = unit.getGridCell(gridConfig);
    }

    const deltas = positions.slice(1).map((position, index) => position - positions[index]);
    for (const delta of deltas) expect(delta).toBeCloseTo(gridConfig.cellSize / 4);
    expect(intermediateCell).toEqual({ col: 1, row: 0 });
    expect(unit.getGridCell(gridConfig)).toEqual({ col: 2, row: 0 });
    expect(unit.currentCommand).toBeUndefined();
  });

  it("cancels partial movement immediately when stopped", () => {
    const unit = createUnit(container, gridState, 0, 0, undefined, 2);
    const origin = gridToWorld(0, 0, gridConfig);
    const nextCell = gridToWorld(1, 0, gridConfig);
    unit.issueCommand(new MoveCommand({ col: 3, row: 0 }));
    unit.update(ticker(1));

    expect(unit.position.x).toBeGreaterThan(origin.x);
    expect(unit.position.x).toBeLessThan(nextCell.x);
    expect(unit.getCommandMovementState().stepProgress).toBe(0.5);

    unit.issueCommand(new StopCommand());
    expect(unit.currentCommand).toBeUndefined();
    expect(unit.position).toMatchObject(origin);
    expect(unit.getCommandMovementState()).toMatchObject({
      route: [],
      targetCell: null,
      stepProgress: 0,
    });
    unit.update(ticker(2));
    unit.update(ticker(3));

    expect(unit.getGridCell(gridConfig)).toEqual({ col: 0, row: 0 });
    expect(gridState.getCell({ col: 0, row: 0 })?.occupantId).toBe(unit.getId());
  });

  it("waits and resumes a move command after a temporary block", () => {
    const unit = createUnit(container, gridState, 0, 0);
    const command = new MoveCommand({ col: 2, row: 0 });
    unit.issueCommand(command);
    gridState.occupyCell({ col: 1, row: 0 }, "blocking-unit");

    unit.update(ticker(1));

    expect(command.status).toBe("running");
    expect(unit.currentCommand).toBe(command);
    expect(unit.getGridCell(gridConfig)).toEqual({ col: 0, row: 0 });

    gridState.liberateCell({ col: 1, row: 0 });
    for (let frame = 2; frame <= 10 && command.status === "running"; frame++) {
      unit.update(ticker(frame));
    }

    expect(command.status).toBe("completed");
    expect(unit.getGridCell(gridConfig)).toEqual({ col: 2, row: 0 });
  });

  it("patrols continuously between two cells", () => {
    const unit = createUnit(container, gridState, 0, 0);
    unit.issueCommand(
      new PatrolCommand([
        { col: 0, row: 0 },
        { col: 2, row: 0 },
      ]),
    );

    unit.update(ticker(1));
    unit.update(ticker(2));
    expect(unit.getGridCell(gridConfig)).toEqual({ col: 2, row: 0 });

    unit.update(ticker(3));
    unit.update(ticker(4));
    expect(unit.getGridCell(gridConfig)).toEqual({ col: 0, row: 0 });

    unit.update(ticker(5));
    expect(unit.getGridCell(gridConfig)).toEqual({ col: 1, row: 0 });
    expect(unit.currentCommand?.type).toBe("patrol");
  });

  it("repaths toward an attack target when the target moves", () => {
    const projectileCreator = new UnitCreator<Projectile>({
      container,
      initialPoolSize: 1,
      factory: () => new Projectile(container),
    });
    const attacker = createUnit(container, gridState, 0, 0, {
      range: 1,
      damage: 10,
      fireRate: 0,
      projectileCreator,
    });
    const target = createUnit(container, gridState, 3, 0);

    attacker.issueCommand(new AttackCommand(target));
    attacker.update(ticker(1));
    expect(attacker.getGridCell(gridConfig)).toEqual({ col: 1, row: 0 });

    target.issueCommand(new MoveCommand({ col: 4, row: 0 }));
    target.update(ticker(2));
    attacker.update(ticker(2));
    attacker.update(ticker(3));

    expect(target.getGridCell(gridConfig)).toEqual({ col: 4, row: 0 });
    expect(attacker.getGridCell(gridConfig)).toEqual({ col: 3, row: 0 });
    expect(attacker.currentCommand?.type).toBe("attack");
    expect(projectileCreator.getUnits(true)).toHaveLength(1);
  });

  it("holds and shoots, while stop suppresses shooting", () => {
    const projectileCreator = new UnitCreator<Projectile>({
      container,
      initialPoolSize: 2,
      factory: () => new Projectile(container),
    });
    const holdUnit = createUnit(container, gridState, 0, 0, {
      range: 2,
      damage: 10,
      fireRate: 0,
      projectileCreator,
    });
    const stoppedUnit = createUnit(container, gridState, 0, 2, {
      range: 2,
      damage: 10,
      fireRate: 0,
      projectileCreator,
    });
    const holdTarget = createUnit(container, gridState, 1, 0);
    const stopTarget = createUnit(container, gridState, 1, 2);
    holdUnit.setShootingTargets([holdTarget]);
    stoppedUnit.setShootingTargets([stopTarget]);

    holdUnit.issueCommand(new HoldPositionCommand());
    stoppedUnit.issueCommand(new StopCommand());
    holdUnit.update(ticker(1));
    stoppedUnit.update(ticker(1));

    expect(projectileCreator.getUnits(true)).toHaveLength(1);
    expect(projectileCreator.getUnits(true)[0].targetUnit).toBe(holdTarget);
    expect(holdUnit.getGridCell(gridConfig)).toEqual({ col: 0, row: 0 });
    expect(stoppedUnit.getGridCell(gridConfig)).toEqual({ col: 0, row: 2 });
  });
});
