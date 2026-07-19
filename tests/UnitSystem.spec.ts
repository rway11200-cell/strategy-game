import { Container, Texture } from "pixi.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/app/utils/sprite", () => ({
  getFramesAseprite: () => ({ textures: [Texture.EMPTY], totalMs: 0, frameMs: [0] }),
}));

import { Enemy, EnemyType } from "../src/app/core/unidades/Enemy";
import { Unit } from "../src/app/core/unidades/Unit";
import { UnitSystem } from "../src/app/core/unidades/UnitSystem";

describe("unified unit system", () => {
  beforeAll(() => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("stores shared combat, faction, position, and state data", () => {
    const position = { x: 12, y: 24 };
    const model = new UnitSystem({
      hp: 80,
      maxHp: 100,
      damage: 15,
      speed: 2,
      range: 3,
      team: "player",
      position,
    });

    expect(model.stats).toEqual({ hp: 80, maxHp: 100, damage: 15, speed: 2, range: 3 });
    expect(model.faction).toBe("player");
    expect(model.position).toBe(position);

    model.takeDamage(80);
    expect(model.state).toBe("dead");
  });

  it("exposes the same model through player units", () => {
    const unit = new Unit(new Container(), {
      framesJson: { idle: "player.json" },
      hp: 120,
      damage: 25,
      speed: 1.5,
      range: 4,
      position: { x: 10, y: 20 },
    });

    expect(unit.team).toBe("player");
    expect(unit.stats).toEqual({ hp: 120, maxHp: 120, damage: 25, speed: 1.5, range: 4 });
    expect(unit.model.position).toBe(unit.position);
    expect(unit.position).toMatchObject({ x: 10, y: 20 });

    unit.spawn();
    unit.takeDamage(120);
    expect(unit.hp).toBe(0);
    expect(unit.state).toBe("dead");
    expect(unit.active).toBe(false);
  });

  it("models enemies as AI-controlled enemy units", () => {
    const enemy = new Enemy(new Container());
    enemy.initializeEnemy(EnemyType.Goblin);
    enemy.spawn();

    expect(enemy).toBeInstanceOf(Unit);
    expect(enemy.team).toBe("enemy");
    expect(enemy.faction).toBe("enemy");
    expect(enemy.controller).toBe("ai");
    expect(enemy.isAIControlled).toBe(true);
    expect(enemy.enemyType).toBe(EnemyType.Goblin);
    expect(enemy.stats).toEqual({ hp: 50, maxHp: 50, damage: 6, speed: 0.6, range: 1 });
  });
});
