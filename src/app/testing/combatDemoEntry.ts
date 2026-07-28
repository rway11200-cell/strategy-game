import { Application, Assets, Container, Graphics, Ticker } from "pixi.js";
import { createGridConfig, gridToWorld } from "../../core/grid/GridConfig";
import { GridState } from "../../grid/GridState";
import { UnitArchetype, initializeUnitArchetype } from "../core/unidades/UnitArchetype";
import { Projectile } from "../core/unidades/Projectile";
import { Unit } from "../core/unidades/Unit";
import { UnitCreator } from "../core/UnitCreator";
import { MoveCommand } from "../core/UnitCommands";

const GRID_COLS = 30;
const GRID_ROWS = 20;
const CELL_SIZE = 32;

const gridConfig = createGridConfig({ gridWidth: GRID_COLS, gridHeight: GRID_ROWS, cellSize: CELL_SIZE });
const gridState = new GridState(gridConfig);

const app = new Application();
const container = new Container();

const projectileCreator = new UnitCreator<Projectile>({
  container,
  initialPoolSize: 20,
  factory: () => new Projectile(container),
});

const enemies: Unit[] = [];

const eventLog: string[] = [];
const MAX_LOG = 30;

function log(msg: string, cls = "ev") {
  eventLog.push(`<span class="${cls}">${msg}</span>`);
  if (eventLog.length > MAX_LOG) eventLog.shift();
  updateLogUI();
}

function updateLogUI() {
  const el = document.getElementById("event-log");
  if (el) el.innerHTML = eventLog.join("<br>");
}

let hudUpdateTimer = 0;

async function init() {
  await app.init({
    background: "#1a1a2e",
    resizeTo: document.getElementById("pixi-container")!,
    resolution: window.devicePixelRatio || 1,
  });
  container.sortableChildren = true;
  app.stage.addChild(container);
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  await Assets.init({ basePath: "/assets" });
  await Assets.loadBundle("main");

  drawGrid();
  spawnDemoSetup();
  setupControls();
  app.ticker.add(mainLoop);
  addLegend();
}

function drawGrid() {
  const g = new Graphics();
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const color = (row + col) % 2 === 0 ? 0x16213e : 0x1a1a2e;
      const { x, y } = gridToWorld(col, row, gridConfig);
      const half = CELL_SIZE / 2;
      g.rect(x - half, y - half, CELL_SIZE, CELL_SIZE).fill({ color, alpha: 0.6 });
    }
  }
  g.alpha = 0.5;
  container.addChild(g);
}

function makeDemoUnit(
  archetype: UnitArchetype,
  col: number,
  row: number,
  team: "player" | "enemy",
): Unit {
  const unit = new Unit(container, { id: `${team}-${archetype}-${col}-${row}` });
  initializeUnitArchetype(unit, archetype, { team, controller: team === "enemy" ? "ai" : "player" });
  unit.model.configure({
    attackMode: "melee",
    cooldown: 800,
    damageType: team === "player" ? "pierce" : "normal",
    armorType: archetype === UnitArchetype.Skeleton ? "heavy" : "light",
    vision: 100,
  });
  unit.initializeShootingRange({
    range: 1,
    fireRate: 1,
    damage: unit.attackDamage,
    projectileCreator,
    targets: [],
    damageType: team === "player" ? "pierce" : "normal",
  });
  unit.initializeTileMovement({
    cells: [],
    gridConfig,
    gridState,
    start: { col, row },
    entityType: archetype,
  });
  unit.initializeSpeed(0.8);
  unit.spawn();

  const { x, y } = gridToWorld(col, row, gridConfig);
  unit.position.set(x, y);
  unit.onDeath = (id) => log(`☠ ${id} muri\u00f3`, "ev-death");
  unit.onTargetAcquired = (tid) => log(`\uD83C\uDFAF ${unit.getId()} adquiri\u00f3 ${tid}`, "ev-acq");
  unit.onDamageApplied = (tid, amt, before, after) => {
    const dmgType = unit.model.damageType;
    log(`\uD83D\uDCA5 ${unit.getId()} da\u00f1\u00f3 ${tid} ${amt}(${dmgType}) ${before}\u2192${after}`, "ev-dmg");
  };
  unit.onDespawn = (id) => log(`\uD83D\uDC80 ${id} despawneado`, "ev-death");

  container.addChild(unit);
  return unit;
}

function spawnDemoSetup() {
  const teamA: Unit[] = [];
  const teamB: Unit[] = [];

  for (let i = 0; i < 3; i++) {
    const u = makeDemoUnit(UnitArchetype.Goblin, 2 + i * 2, 2, "enemy");
    u.model.configure({ damageType: "normal", armorType: "unarmored", damage: 8, vision: 100 });
    teamA.push(u);
    enemies.push(u);
  }
  for (let i = 0; i < 2; i++) {
    const u = makeDemoUnit(UnitArchetype.Skeleton, 2 + i * 3, 5, "enemy");
    u.model.configure({ damageType: "normal", armorType: "heavy", damage: 15, vision: 100 });
    teamA.push(u);
    enemies.push(u);
  }

  for (let i = 0; i < 3; i++) {
    const u = makeDemoUnit(UnitArchetype.Soldier, 22 + i * 2, 12, "player");
    u.model.configure({ damageType: "pierce", armorType: "light", damage: 12, vision: 100 });
    teamB.push(u);
    enemies.push(u);
  }
  for (let i = 0; i < 2; i++) {
    const u = makeDemoUnit(UnitArchetype.Ghost, 22 + i * 3, 15, "player");
    u.model.configure({ damageType: "magic", armorType: "light", damage: 18, vision: 100 });
    teamB.push(u);
    enemies.push(u);
  }

  teamA.forEach((u) => u.setShootingTargets(teamB));
  teamB.forEach((u) => u.setShootingTargets(teamA));

  for (const u of teamA) {
    const dest = { col: 26, row: 14 };
    u.issueCommand(new MoveCommand(dest));
  }
  for (const u of teamB) {
    const dest = { col: 4, row: 4 };
    u.issueCommand(new MoveCommand(dest));
  }

  log("Demo iniciado: 2 equipos con diferentes tipos de armadura y da\u00f1o");
  log("\uD83D\uDDE1 Team Enemy: Goblin(unarmored) + Skeleton(heavy) = normal dmg");
  log("\uD83D\uDDE1 Team Player: Warrior(light/pierce) + Ghost(light/magic)");
}

function setupControls() {
  document.getElementById("btn-spawn-melee")?.addEventListener("click", () => {
    doSpawnSetup("melee");
  });
  document.getElementById("btn-spawn-ranged")?.addEventListener("click", () => {
    doSpawnSetup("ranged");
  });
  document.getElementById("btn-spawn-tank")?.addEventListener("click", () => {
    doSpawnSetup("tank");
  });
  document.getElementById("btn-clear")?.addEventListener("click", () => {
    clearUnits();
  });
}

function doSpawnSetup(kind: string) {
  const side = kind === "tank" ? "enemy" : "player";

  let archetype = UnitArchetype.Goblin;
  let dmgType: "normal" | "pierce" | "magic" | "siege" = "normal";
  let armType: "unarmored" | "light" | "heavy" | "fortified" = "light";
  let hp = 50;

  if (kind === "melee") {
    archetype = UnitArchetype.Soldier;
    dmgType = "pierce";
    armType = "light";
    hp = 100;
  } else if (kind === "ranged") {
    archetype = UnitArchetype.Ghost;
    dmgType = "magic";
    armType = "light";
    hp = 70;
  } else if (kind === "tank") {
    archetype = UnitArchetype.Skeleton;
    dmgType = "siege";
    armType = "fortified";
    hp = 400;
  }

  const col = 15 + Math.floor(Math.random() * 8);
  const row = 8 + Math.floor(Math.random() * 6);

  const u = makeDemoUnit(archetype, col, row, side);
  u.model.configure({ damageType: dmgType, armorType: armType, vision: 100 });
  u.model.maxHp = hp;
  u.model.hp = hp;
  u.initializeHealthBar(hp);

  const opponentTargets = enemies.filter((e) => e !== u && u.isHostileTo(e));
  u.setShootingTargets(opponentTargets);

  const aggressors = enemies.filter((e) => e !== u && e.isHostileTo(u));
  aggressors.forEach((opp) => opp.addShootingTarget(u));

  enemies.push(u);
  const dest = side === "player" ? { col: 6, row: 6 } : { col: 24, row: 14 };
  u.issueCommand(new MoveCommand(dest));

  log(`Spawned ${kind} (${dmgType}/${armType}) en (${col},${row})`);
}

function clearUnits() {
  for (const u of enemies) u.despawnImmediately();
  enemies.length = 0;
  eventLog.length = 0;
  updateLogUI();
  log("Escenario limpiado");
}

function updateSystemState() {
  const el = document.getElementById("system-state");
  if (!el) return;

  const total = enemies.length;
  const alive = enemies.filter((u) => u.lifecycle === "alive").length;
  const dying = enemies.filter((u) => u.lifecycle === "dying").length;
  const dead = enemies.filter((u) => u.lifecycle === "dead").length;

  const dmgTypes = [...new Set(enemies.map((u) => u.model.damageType))].join(", ");
  const armTypes = [...new Set(enemies.map((u) => u.model.armorType))].join(", ");

  el.innerHTML = `
    <div class="row"><span class="label">Unidades</span><span class="value">${total}</span></div>
    <div class="row"><span class="label">Alive</span><span class="value" style="color:#66bb6a">${alive}</span></div>
    <div class="row"><span class="label">Dying</span><span class="value" style="color:#ff7043">${dying}</span></div>
    <div class="row"><span class="label">Dead (corpse)</span><span class="value" style="color:#888">${dead}</span></div>
    <div class="row"><span class="label">Da\u00f1o activo</span><span class="value">${dmgTypes || "-"}</span></div>
    <div class="row"><span class="label">Armadura</span><span class="value">${armTypes || "-"}</span></div>
  `;
}

function mainLoop(ticker: Ticker) {
  const active = enemies.filter((u) => u.active);

  active.forEach((unit) => {
    unit.update(ticker);

    if (unit.lifecycle === "alive") {
      const targets = active.filter((o) => o !== unit && unit.isHostileTo(o));
      unit.setShootingTargets(targets);
    }
  });

  hudUpdateTimer += ticker.deltaTime;
  if (hudUpdateTimer > 30) {
    hudUpdateTimer = 0;
    updateSystemState();
  }
}

function addLegend() {
  const el = document.getElementById("legend-content");
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
      <div><b>Tipos de da\u00f1o:</b></div>
      <div><span class="badge badge-normal">normal</span> 1.0x contra todo</div>
      <div><span class="badge badge-pierce">pierce</span> 1.5x light, 0.5x heavy, 0.35x fortified</div>
      <div><span class="badge badge-magic">magic</span> 1.5x heavy, 1.25x light, 0.5x fortified</div>
      <div><span class="badge badge-siege">siege</span> 1.5x fortified, 0.75x light</div>
      <div style="margin-top:4px"><b>Armadura:</b></div>
      <div><span class="badge badge-unarmored">unarmored</span> <span class="badge badge-light">light</span> <span class="badge badge-heavy">heavy</span> <span class="badge badge-fortified">fortified</span></div>
    </div>
  `;
}

init().catch(console.error);
