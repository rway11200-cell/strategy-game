import { Container, Graphics, Ticker } from "pixi.js";
import { createGridConfig, gridToWorld, type CellCoord, type GridConfig } from "../../grid/GridConfig";
import { GridState } from "../../grid/GridState";
import { UnitCreator } from "./UnitCreator";
import { Enemy, EnemyType } from "./unidades/Enemy";
import { Projectile } from "./unidades/Projectile";
import { Unit } from "./unidades/Unit";
import {
  AttackCommand,
  AttackMoveCommand,
  HoldPositionCommand,
  MoveCommand,
  PatrolCommand,
  StopCommand,
} from "./UnitCommands";

const GRID_COLS = 40;
const GRID_ROWS = 24;
const CELL_SIZE = 32;
const BLOCK_COUNT = 12;

function randomCell(cols: number, rows: number): { col: number; row: number } {
  return {
    col: Math.floor(Math.random() * cols),
    row: Math.floor(Math.random() * rows),
  };
}

export class SandboxManager {
  readonly gridConfig: GridConfig;
  readonly gridState: GridState;
  private readonly unitCreator: UnitCreator<Enemy>;
  private readonly projectileCreator: UnitCreator<Projectile>;
  private readonly allUnits: Enemy[] = [];
  private readonly blockedCells: Set<string> = new Set();

  constructor(private readonly worldContainer: Container) {
    this.gridConfig = createGridConfig({
      gridWidth: GRID_COLS,
      gridHeight: GRID_ROWS,
      cellSize: CELL_SIZE,
      offsetX: (1600 - GRID_COLS * CELL_SIZE) / 2,
      offsetY: (1080 - GRID_ROWS * CELL_SIZE) / 2,
    });
    this.gridState = new GridState(this.gridConfig);

    this.placeBlockedCells();
    this.drawGrid();

    this.projectileCreator = new UnitCreator<Projectile>({
      container: worldContainer,
      initialPoolSize: 5,
      factory: () => new Projectile(worldContainer),
    });

    this.unitCreator = new UnitCreator<Enemy>({
      container: worldContainer,
      initialPoolSize: 12,
      factory: () => new Enemy(worldContainer),
    });

    this.spawnTeams();
  }

  private placeBlockedCells(): void {
    const tries = BLOCK_COUNT * 3;
    for (let i = 0; i < tries && this.blockedCells.size < BLOCK_COUNT; i++) {
      const cell = randomCell(GRID_COLS, GRID_ROWS);
      const key = `${cell.col},${cell.row}`;
      if (this.blockedCells.has(key)) continue;
      const existing = this.gridState.getCell(cell);
      if (existing?.type === "blocked") continue;
      this.gridState.setCell(cell, { type: "blocked", occupied: false, walkCost: 1 });
      this.blockedCells.add(key);
    }
  }

  private drawGrid(): void {
    const g = new Graphics();
    const size = CELL_SIZE;
    const cols = GRID_COLS;
    const rows = GRID_ROWS;
    const ox = this.gridConfig.offsetX;
    const oy = this.gridConfig.offsetY;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = this.gridState.getCell({ col, row });
        const color = cell?.type === "blocked" ? 0x37474f : 0x2e7d32;
        g.rect(ox + col * size, oy + row * size, size, size).fill({ color, alpha: 0.5 });
      }
    }

    for (let c = 0; c <= cols; c++) {
      g.moveTo(ox + c * size, oy).lineTo(ox + c * size, oy + rows * size);
    }
    for (let r = 0; r <= rows; r++) {
      g.moveTo(ox, oy + r * size).lineTo(ox + cols * size, oy + r * size);
    }
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.15 });

    this.worldContainer.addChild(g);
  }

  private spawnTeams(): void {
    const occupied = new Set<string>();

    for (let teamIndex = 0; teamIndex < 2; teamIndex++) {
      const team: "player" | "enemy" = teamIndex === 0 ? "player" : "enemy";
      const archetype = teamIndex === 0 ? EnemyType.Warrior : EnemyType.Skeleton;

      for (let i = 0; i < 5; i++) {
        let cell: { col: number; row: number };
        let key: string;
        let attempts = 0;
        do {
          cell = randomCell(GRID_COLS, GRID_ROWS);
          key = `${cell.col},${cell.row}`;
          attempts++;
        } while (
          (occupied.has(key) || this.blockedCells.has(key) || this.gridState.getCell(cell)?.type === "blocked") &&
          attempts < 200
        );

        occupied.add(key);
        const world = gridToWorld(cell.col, cell.row, this.gridConfig);
        const unit = this.unitCreator.get();
        unit.initializeEnemy(archetype);
        if (archetype === EnemyType.Warrior) unit.scale.set(1 / 3);
        unit.team = team;
        const cooldown = archetype === EnemyType.Warrior ? 500 : 2000;
        unit.model.configure({ attackMode: "melee", cooldown });
        unit.initializeShootingRange({
          range: 1,
          fireRate: 0.5,
          damage: unit.attackDamage,
          projectileCreator: this.projectileCreator,
          targets: [],
        });
        unit.initializeTileMovement({
          cells: [],
          gridConfig: this.gridConfig,
          gridState: this.gridState,
          start: cell,
          entityType: archetype,
        });
        unit.spawn();
        unit.position.set(world.x, world.y);
        this.allUnits.push(unit);
      }
    }

    this.refreshTargets();
  }

  private refreshTargets(): void {
    const active = this.allUnits.filter((u) => u.active && !u.isDead() && u.canBeProjectileTarget);
    for (const unit of this.allUnits) {
      if (!unit.model.canAttack || !unit.active || unit.isDead()) continue;
      const targets = active.filter((other) => other !== unit && unit.isHostileTo(other));
      unit.setShootingTargets(targets);
    }
  }

  update(_time: Ticker): void {
    this.refreshTargets();
    for (const unit of this.allUnits) {
      if (unit.active && unit.animatedSprite?.visible !== false) {
        unit.update(_time);
      }
    }
  }

  getActiveUnits(): Unit[] {
    return this.allUnits.filter((u) => u.active && !u.isDead());
  }

  issueMove(unit: Unit, destination: CellCoord): void {
    unit.issueCommand(new MoveCommand(destination));
  }

  issueAttackMove(unit: Unit, destination: CellCoord): void {
    unit.issueCommand(new AttackMoveCommand(destination));
  }

  issueAttack(unit: Unit, target: Unit): void {
    unit.issueCommand(new AttackCommand(target));
  }

  issueStop(unit: Unit): void {
    unit.issueCommand(new StopCommand());
  }

  issueHold(unit: Unit): void {
    unit.issueCommand(new HoldPositionCommand());
  }

  issuePatrol(unit: Unit, endpoints: [CellCoord, CellCoord]): void {
    unit.issueCommand(new PatrolCommand(endpoints));
  }

  findUnitAt(cell: CellCoord): Unit | undefined {
    return this.allUnits.find((u) => {
      if (!u.active || u.isDead()) return false;
      const uc = u.getGridCell(this.gridConfig);
      return uc && uc.col === cell.col && uc.row === cell.row;
    });
  }
}
