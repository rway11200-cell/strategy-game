import { Container, Texture, type Ticker } from "pixi.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/utils/sprite", () => ({
  getFramesAseprite: () => ({ textures: [Texture.EMPTY], totalMs: 0, frameMs: [0] }),
}));

import { UnitCreator } from "../src/app/core/UnitCreator";
import { Projectile } from "../src/app/core/unidades/Projectile";
import { Tower } from "../src/app/core/unidades/Tower";
import { Unit, getCurrentOrClosestGridTarget } from "../src/app/core/unidades/Unit";
import { createGridConfig, gridToWorld } from "../src/grid/GridConfig";

const gridConfig = createGridConfig({ gridWidth: 10, gridHeight: 10, cellSize: 64 });

function ticker(lastTime: number, deltaTime = 1): Ticker {
  return { lastTime, deltaTime } as Ticker;
}

function makeTarget(container: Container, col: number, row: number, health = 20): Unit {
  const target = new Unit(container, {
    framesJson: { idle: "target.json" },
    health,
  });
  const position = gridToWorld(col, row, gridConfig);
  target.position.set(position.x, position.y);
  target.spawn();
  return target;
}

describe("grid-based tower combat", () => {
  let container: Container;

  beforeAll(() => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    container = new Container();
  });

  it("selects targets by cell distance rather than pixel distance", () => {
    const inRange = makeTarget(container, 3, 1);
    const outOfRange = makeTarget(container, 4, 1);

    expect(
      getCurrentOrClosestGridTarget(
        { col: 1, row: 1 },
        [outOfRange, inRange],
        2,
        gridConfig,
        undefined,
      ),
    ).toBe(inRange);
  });

  it("uses Euclidean range measured in cells", () => {
    const diagonal = makeTarget(container, 2, 2);

    expect(
      getCurrentOrClosestGridTarget(
        { col: 0, row: 0 },
        [diagonal],
        2,
        gridConfig,
        undefined,
      ),
    ).toBeUndefined();
  });

  it("launches a projectile at the enemy cell and damages its assigned enemy on impact", () => {
    const projectileCreator = new UnitCreator<Projectile>({
      container,
      initialPoolSize: 1,
      factory: () => new Projectile(container),
    });
    const tower = new Tower(container, {
      shootOptions: {
        range: 3,
        damage: 20,
        fireRate: 0.5,
        projectileCreator,
      },
    });
    tower.setGridPosition(1, 1, gridConfig);
    tower.spawn();

    const target = makeTarget(container, 3, 1);
    tower.setShootingTargets([target]);
    tower.update(ticker(500));

    const projectile = projectileCreator.getUnits(true)[0];
    expect(projectile).toBeDefined();
    expect(projectile.targetCell).toEqual({ col: 3, row: 1 });
    expect(projectile.position).toMatchObject(gridToWorld(1, 1, gridConfig));

    projectile.update(ticker(501));
    projectile.update(ticker(502, 100));

    expect(projectile.active).toBe(false);
    expect(target.active).toBe(false);
  });

  it("does not fire at an enemy outside the configured cell range", () => {
    const projectileCreator = new UnitCreator<Projectile>({
      container,
      initialPoolSize: 1,
      factory: () => new Projectile(container),
    });
    const tower = new Tower(container, {
      shootOptions: {
        range: 2,
        damage: 20,
        fireRate: 0.5,
        projectileCreator,
      },
    });
    tower.setGridPosition(1, 1, gridConfig);
    tower.spawn();
    tower.setShootingTargets([makeTarget(container, 4, 1)]);

    tower.update(ticker(1000));

    expect(projectileCreator.getUnits(true)).toHaveLength(0);
  });
});
