import { Container } from "pixi.js";
import { describe, expect, it, vi } from "vitest";
import { TargetFollower } from "../src/app/core/PathFollower";
import { TileMovement } from "../src/app/core/TileMovement";
import { createGridConfig } from "../src/grid/GridConfig";
import { GridState } from "../src/grid/GridState";

function setup(entityType = "goblin", ticksPerCell = 1) {
  const gridConfig = createGridConfig({ gridWidth: 4, gridHeight: 4, cellSize: 64 });
  const gridState = new GridState(gridConfig);
  const follower = new TargetFollower();
  follower.setRouteFromCells({
    cells: [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ],
    gridConfig,
  });
  const movement = new TileMovement({
    gridConfig,
    gridState,
    start: { col: 0, row: 0 },
    entityType,
    occupantId: "enemy-1",
    ticksPerCell,
  });
  const unit = new Container();

  movement.spawn(unit);
  return { follower, gridState, movement, unit };
}

describe("TileMovement", () => {
  it("interpolates smoothly and reaches one cell after ticksPerCell updates", () => {
    const { follower, gridState, movement, unit } = setup("goblin", 2);

    expect(unit.position).toMatchObject({ x: 32, y: 32 });
    expect(gridState.getCell({ col: 0, row: 0 })?.occupantId).toBe("enemy-1");

    expect(movement.walk(unit, follower).moved).toBe(true);
    expect(unit.position).toMatchObject({ x: 64, y: 32 });
    expect(gridState.getCell({ col: 0, row: 0 })?.occupied).toBe(false);
    expect(gridState.getCell({ col: 1, row: 0 })?.occupied).toBe(false);
    expect(gridState.getCell({ col: 1, row: 0 })?.reservedBy).toBe("enemy-1");

    expect(movement.walk(unit, follower).moved).toBe(true);
    expect(unit.position).toMatchObject({ x: 96, y: 32 });
    expect(gridState.getCell({ col: 0, row: 0 })?.occupied).toBe(false);
    expect(gridState.getCell({ col: 1, row: 0 })?.occupantId).toBe("enemy-1");
  });

  it("uses ticker deltaTime while interpolating between cells", () => {
    const { follower, movement, unit } = setup("goblin", 4);

    movement.walk(unit, follower, { deltaTime: 2 } as never);

    expect(unit.position).toMatchObject({ x: 64, y: 32 });
    expect(movement.cell).toEqual({ col: 0, row: 0 });
  });

  it("releases occupancy and notifies once on reaching the destination", () => {
    const { follower, gridState, movement, unit } = setup();
    const onDestinationReached = vi.fn();
    follower.onDestinationReached = onDestinationReached;

    movement.walk(unit, follower);
    const result = movement.walk(unit, follower);
    movement.walk(unit, follower);

    expect(result.destinationReached).toBe(true);
    expect(follower.finished).toBe(true);
    expect(onDestinationReached).toHaveBeenCalledTimes(1);
    expect(gridState.getCell({ col: 2, row: 0 })?.occupied).toBe(false);
  });

  it("moves and releases every cell in the entity footprint", () => {
    const { follower, gridState, movement, unit } = setup("skeleton");

    expect(gridState.getCell({ col: 0, row: 0 })?.occupantId).toBe("enemy-1");

    movement.walk(unit, follower);

    expect(gridState.getCell({ col: 0, row: 0 })?.occupied).toBe(false);
    expect(gridState.getCell({ col: 1, row: 0 })?.occupantId).toBe("enemy-1");
  });

  it("stays in place when the next footprint is occupied", () => {
    const { follower, gridState, movement, unit } = setup();
    gridState.occupyCell({ col: 1, row: 0 }, "other-enemy");

    expect(movement.walk(unit, follower).moved).toBe(false);
    expect(unit.position).toMatchObject({ x: 32, y: 32 });
    expect(gridState.getCell({ col: 0, row: 0 })?.occupantId).toBe("enemy-1");
  });

  it("remains at spawn when no route exists", () => {
    const { follower, gridState, movement, unit } = setup();
    follower.setRouteFromCells({
      cells: [],
      gridConfig: createGridConfig({ gridWidth: 4, gridHeight: 4, cellSize: 64 }),
    });

    expect(movement.walk(unit, follower).moved).toBe(false);
    expect(unit.position).toMatchObject({ x: 32, y: 32 });
    expect(gridState.getCell({ col: 0, row: 0 })?.occupantId).toBe("enemy-1");
  });
});
