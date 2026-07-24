import type {
  ApiResult,
  GameTestApi,
  ScenarioTestState,
  TestScenarioPreset,
} from "./GameTestApi";

const PRESETS = [
  "three-cell-patrol-corridor",
  "long-movement-corridor",
  "hold-position-lane",
  "five-unit-contended-patrol",
  "tower-placement",
  "dense-occupation",
  "follow-the-leader",
  "blocked-route-detour",
  "spawn-point-demo",
  "warrior-march",
  "warrior-duel",
  "warrior-auto-march",
  "warrior-auto-move",
  "warrior-hold-attack",
  "warrior-hold-square",
  "warrior-pursuit-square",
  "warrior-patrol-square",
];

const WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL = 60;

interface PanelState {
  scenarioId: string | null;
  playing: boolean;
  primaryUnitId: string | null;
  reloadDemo: (() => void) | null;
}

export function createGameplayDebugPanel(api: GameTestApi): HTMLDivElement {
  const state: PanelState = {
    scenarioId: null,
    playing: false,
    primaryUnitId: null,
    reloadDemo: null,
  };

  const panel = document.createElement("div");
  panel.id = "debug-panel";

  const scenarioSection = createSection("Scenario");
  const presetSelect = document.createElement("select");
  presetSelect.id = "preset-select";
  for (const p of PRESETS) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    presetSelect.appendChild(opt);
  }
  scenarioSection.appendChild(presetSelect);

  const beginBtn = createButton("Begin");
  const cleanupBtn = createButton("Cleanup");
  cleanupBtn.disabled = true;
  scenarioSection.appendChild(beginBtn);
  scenarioSection.appendChild(cleanupBtn);
  panel.appendChild(scenarioSection);

  const demoSection = createSection("Demo");
  const loadPatrolBtn = createButton("1. Patrol A ↔ B");
  const loadMoveBtn = createButton("2. Move + Stop");
  const loadHoldBtn = createButton("3. Hold Position lane");
  const loadMultiBtn = createButton("4. Five-unit contention");
  const loadDenseBtn = createButton("5. Dense skeleton pair");
  const loadEmptyBtn = createButton("6. Empty selected scenario");
  const loadFollowBtn = createButton("7. Follow the leader");
  const loadDetourBtn = createButton("8. Obstacle detour");
  const loadSpawnPointBtn = createButton("9. Spawn Point");
  const loadWarriorBtn = createButton("10. Warrior march");
  const loadWarriorDuelBtn = createButton("11. Warrior duel");
  const loadAutoMarchBtn = createButton("12. Auto attack march");
  const loadAutoMoveBtn = createButton("13. Auto attack move");
  const loadHoldAttackBtn = createButton("14. Hold position attack");
  const loadHoldSquareBtn = createButton("15. Hold square attack");
  const loadPursuitBtn = createButton("16. Auto pursuit square");
  const loadPatrolAttackBtn = createButton("17. Patrol square attack");
  demoSection.appendChild(loadPatrolBtn);
  demoSection.appendChild(loadMoveBtn);
  demoSection.appendChild(loadHoldBtn);
  demoSection.appendChild(loadMultiBtn);
  demoSection.appendChild(loadDenseBtn);
  demoSection.appendChild(loadFollowBtn);
  demoSection.appendChild(loadDetourBtn);
  demoSection.appendChild(loadSpawnPointBtn);
  demoSection.appendChild(loadWarriorBtn);
  demoSection.appendChild(loadWarriorDuelBtn);
  demoSection.appendChild(loadAutoMarchBtn);
  demoSection.appendChild(loadAutoMoveBtn);
  demoSection.appendChild(loadHoldAttackBtn);
  demoSection.appendChild(loadHoldSquareBtn);
  demoSection.appendChild(loadPursuitBtn);
  demoSection.appendChild(loadPatrolAttackBtn);
  demoSection.appendChild(loadEmptyBtn);
  panel.appendChild(demoSection);

  const controlSection = createSection("Controls");
  const step1Btn = createButton("▶ 1 frame");
  const step10Btn = createButton("▶▶ 10 frames");
  const playBtn = createButton("▶ Play");
  playBtn.id = "play-btn";
  const resetBtn = createButton("⟲ Reset");
  resetBtn.style.backgroundColor = "#444";
  const stopBtn = createButton("■ Stop primary unit");
  stopBtn.disabled = true;
  const speedSelect = document.createElement("select");
  speedSelect.id = "playback-speed";
  for (const [label, value] of [
    ["0.25x", "0.25"],
    ["1x", "1"],
    ["2x", "2"],
    ["4x", "4"],
    ["Instant", "32"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `Playback ${label}`;
    option.selected = value === "1";
    speedSelect.appendChild(option);
  }
  controlSection.appendChild(step1Btn);
  controlSection.appendChild(step10Btn);
  controlSection.appendChild(playBtn);
  controlSection.appendChild(resetBtn);
  controlSection.appendChild(stopBtn);
  controlSection.appendChild(speedSelect);
  panel.appendChild(controlSection);

  const hudSection = createSection("State");
  const hud = document.createElement("pre");
  hud.id = "hud";
  hud.textContent = "No scenario active";
  hudSection.appendChild(hud);
  panel.appendChild(hudSection);

  const eventSection = createSection("Events");
  const eventLog = document.createElement("div");
  eventLog.id = "event-log";
  eventLog.style.cssText = "font-size: 11px; max-height: 200px; overflow-y: auto; font-family: monospace;";
  eventSection.appendChild(eventLog);
  panel.appendChild(eventSection);

  function refreshHUD(): void {
    if (!state.scenarioId) {
      hud.textContent = "No scenario active";
      return;
    }
    try {
      const snapshot = api.getScenarioSnapshot(state.scenarioId);
      const lines: string[] = [];
      lines.push(`Scenario: ${snapshot.scenarioId}`);
      lines.push(`Frame: ${snapshot.frame}`);
      lines.push(`Events: ${snapshot.events.length}`);
      for (const unit of snapshot.units) {
        const cell = unit.cell ? `(${unit.cell.col},${unit.cell.row})` : "?";
        const progress = Math.round(unit.movement.stepProgress * 100);
        const world = `(${unit.world.x.toFixed(1)},${unit.world.y.toFixed(1)})`;
        const occupied = unit.occupiedCells.map((c) => `(${c.col},${c.row})`).join(" ");
        const orderInfo = unit.order
          ? ` [${unit.order.type}] ${unit.order.status}${unit.order.completedCycles !== undefined ? ` cycles:${unit.order.completedCycles}` : ""}`
          : "";
        lines.push(
          `  ${unit.id} activity:${unit.activity} cell:${cell} world:${world} step:${progress}% hp:${unit.hp}/${unit.maxHp} target:${unit.combat.targetId ?? "-"} occ:[${occupied}]${orderInfo}`,
        );
      }
      if (snapshot.orders.length > 0) {
        lines.push("Orders:");
        for (const order of snapshot.orders.slice(-6)) {
          lines.push(`  ${order.id} ${order.type} ${order.status}`);
        }
      }
      hud.textContent = lines.join("\n");

      const recent = snapshot.events.slice(-10);
      eventLog.innerHTML = recent
        .map((e) => {
          const from = e.from ? `(${e.from.col},${e.from.row})` : "";
          const to = e.to ? `(${e.to.col},${e.to.row})` : "";
          const detail = from || to ? ` ${from}→${to}` : "";
          return `<div>#${e.sequence} f:${e.frame} ${e.type}${detail}</div>`;
        })
        .join("");
    } catch {
      hud.textContent = "Scenario snapshot error";
    }
  }

  let frameHandle: number | null = null;
  let playbackAccumulator = 0;

  function unwrap<T>(result: ApiResult<T>): T | null {
    if (result.ok) return result.value;
    hud.textContent = `Error: ${result.error.message}`;
    return null;
  }

  function stopPlayback(): void {
    state.playing = false;
    playbackAccumulator = 0;
    playBtn.textContent = "▶ Play";
    if (frameHandle !== null) cancelAnimationFrame(frameHandle);
    frameHandle = null;
  }

  function cleanupActiveScenario(): void {
    stopPlayback();
    if (state.scenarioId) api.cleanupScenario(state.scenarioId);
    state.scenarioId = null;
    state.primaryUnitId = null;
    state.reloadDemo = null;
    cleanupBtn.disabled = true;
    stopBtn.disabled = true;
  }

  function beginScenario(preset: TestScenarioPreset): ScenarioTestState | null {
    cleanupActiveScenario();
    const scenario = unwrap(api.beginScenario({ preset, simulation: "manual" }));
    if (!scenario) return null;
    state.scenarioId = scenario.id;
    cleanupBtn.disabled = false;
    return scenario;
  }

  function setPrimaryUnit(unitId: string | null): void {
    state.primaryUnitId = unitId;
    stopBtn.disabled = unitId === null;
  }

  function loadPatrolDemo(): void {
    const scenario = beginScenario("three-cell-patrol-corridor");
    if (!scenario) return;
    const unitId = "patrol-unit";
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: unitId,
      archetype: "goblin",
      team: "enemy",
      cell: scenario.landmarks.start,
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId,
      order: {
        type: "patrol",
        endpoints: [scenario.landmarks.start, scenario.landmarks.end],
      },
    }))) return;
    setPrimaryUnit(unitId);
    state.reloadDemo = loadPatrolDemo;
    refreshHUD();
  }

  function loadMoveDemo(): void {
    const scenario = beginScenario("long-movement-corridor");
    if (!scenario) return;
    const unitId = "stoppable-unit";
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: unitId,
      archetype: "goblin",
      team: "player",
      cell: scenario.landmarks.origin,
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId,
      order: { type: "move", destination: scenario.landmarks.destination },
    }))) return;
    setPrimaryUnit(unitId);
    state.reloadDemo = loadMoveDemo;
    refreshHUD();
  }

  function loadHoldDemo(): void {
    const scenario = beginScenario("hold-position-lane");
    if (!scenario) return;
    const allyId = "holding-ally";
    const enemyId = "passing-enemy";
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: allyId,
      archetype: "test-ranged-unit",
      team: "player",
      cell: scenario.landmarks.ally,
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: enemyId,
      archetype: "goblin",
      team: "enemy",
      cell: scenario.landmarks.enemyStart,
    }))) return;
    if (!unwrap(api.issueTestOrder({ unitId: allyId, order: { type: "hold-position" } }))) {
      return;
    }
    if (!unwrap(api.issueTestOrder({
      unitId: enemyId,
      order: { type: "move", destination: scenario.landmarks.enemyEnd },
    }))) return;
    setPrimaryUnit(allyId);
    state.reloadDemo = loadHoldDemo;
    refreshHUD();
  }

  function loadMultiUnitDemo(): void {
    const scenario = beginScenario("five-unit-contended-patrol");
    if (!scenario) return;
    const unitIds = Array.from({ length: 5 }, (_, index) => `patrol-${index + 1}`);
    for (const [index, unitId] of unitIds.entries()) {
      const spawnCell = scenario.groups.spawnCells[index];
      if (!spawnCell) {
        hud.textContent = `Error: missing spawn cell for ${unitId}`;
        return;
      }
      if (!unwrap(api.spawnTestUnit({
        scenarioId: scenario.id,
        id: unitId,
        archetype: "goblin",
        team: "enemy",
        cell: spawnCell,
      }))) return;
      if (!unwrap(api.issueTestOrder({
        unitId,
        order: {
          type: "patrol",
          endpoints: [scenario.landmarks.pointA, scenario.landmarks.pointB],
        },
      }))) return;
    }
    setPrimaryUnit(null);
    state.reloadDemo = loadMultiUnitDemo;
    refreshHUD();
  }

  function loadDenseDemo(): void {
    const scenario = beginScenario("dense-occupation");
    if (!scenario) return;
    const spawnCells = scenario.groups.spawnCells;
    if (!spawnCells || spawnCells.length < 9) return;
    for (let i = 0; i < 9; i++) {
      const unitId = `skeleton-${i}`;
      if (!unwrap(api.spawnTestUnit({
        scenarioId: scenario.id,
        id: unitId,
        archetype: "skeleton",
        team: "enemy",
        cell: spawnCells[i],
      }))) return;
    }
    for (let i = 0; i < 9; i++) {
      if (!unwrap(api.issueTestOrder({
        unitId: `skeleton-${i}`,
        order: { type: "move", destination: scenario.landmarks.destination },
      }))) return;
    }
    setPrimaryUnit("skeleton-0");
    state.reloadDemo = loadDenseDemo;
    refreshHUD();
  }

  function loadFollowDemo(): void {
    const scenario = beginScenario("follow-the-leader");
    if (!scenario) return;
    const start = scenario.landmarks.start;
    for (let i = 0; i < 3; i++) {
      const unitId = `follower-${i}`;
      if (!unwrap(api.spawnTestUnit({
        scenarioId: scenario.id,
        id: unitId,
        archetype: "skeleton",
        team: "enemy",
        cell: start,
      }))) return;
    }
    for (let i = 0; i < 3; i++) {
      if (!unwrap(api.issueTestOrder({
        unitId: `follower-${i}`,
        order: { type: "move", destination: scenario.landmarks.destination },
      }))) return;
    }
    setPrimaryUnit("follower-0");
    state.reloadDemo = loadFollowDemo;
    refreshHUD();
  }

  function loadDetourDemo(): void {
    const scenario = beginScenario("blocked-route-detour");
    if (!scenario) return;
    const unitId = "detour-unit";
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: unitId,
      archetype: "goblin",
      team: "player",
      cell: scenario.landmarks.origin,
      stats: { movementFramesPerCell: 140 },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId,
      order: { type: "move", destination: scenario.landmarks.destination },
    }))) return;
    setPrimaryUnit(unitId);
    state.reloadDemo = loadDetourDemo;
    refreshHUD();
  }

  function loadSpawnPointDemo(): void {
    const scenario = beginScenario("spawn-point-demo");
    if (!scenario) return;
    setPrimaryUnit(null);
    state.reloadDemo = loadSpawnPointDemo;
    refreshHUD();
  }

  function loadWarriorDemo(): void {
    const scenario = beginScenario("warrior-march");
    if (!scenario) return;
    const unitId = "blue-warrior";
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: unitId,
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.origin,
      stats: { movementFramesPerCell: WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId,
      order: { type: "move", destination: scenario.landmarks.destination },
    }))) return;
    setPrimaryUnit(unitId);
    state.reloadDemo = loadWarriorDemo;
    refreshHUD();
  }

  function loadWarriorDuelDemo(): void {
    const scenario = beginScenario("warrior-duel");
    if (!scenario) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "blue-attacker",
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.attacker,
      stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "blue-defender",
      archetype: "warrior",
      team: "enemy",
      cell: scenario.landmarks.defender,
      stats: { hp: 200, damage: 4, rangeCells: 1, fireCooldownFrames: 60 },
    }))) return;
    setPrimaryUnit("blue-attacker");
    state.reloadDemo = loadWarriorDuelDemo;
    refreshHUD();
  }

  function loadAutoMarchDemo(): void {
    const scenario = beginScenario("warrior-auto-march");
    if (!scenario) return;
    const stats = { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL };
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "marching-player",
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.playerStart,
      stats,
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "marching-enemy",
      archetype: "warrior",
      team: "enemy",
      cell: scenario.landmarks.enemyStart,
      stats: { ...stats, damage: 4, fireCooldownFrames: 60 },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "marching-player",
      order: { type: "attack-move", destination: scenario.landmarks.playerDestination },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "marching-enemy",
      order: { type: "attack-move", destination: scenario.landmarks.enemyDestination },
    }))) return;
    setPrimaryUnit("marching-player");
    state.reloadDemo = loadAutoMarchDemo;
    refreshHUD();
  }

  function loadAutoMoveDemo(): void {
    const scenario = beginScenario("warrior-auto-move");
    if (!scenario) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "moving-attacker",
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.attackerStart,
      stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL },
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "stationary-defender",
      archetype: "warrior",
      team: "enemy",
      cell: scenario.landmarks.defender,
      stats: { hp: 200 },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "moving-attacker",
      order: { type: "move", destination: scenario.landmarks.destination },
    }))) return;
    setPrimaryUnit("moving-attacker");
    state.reloadDemo = loadAutoMoveDemo;
    refreshHUD();
  }

  function loadHoldAttackDemo(): void {
    const scenario = beginScenario("warrior-hold-attack");
    if (!scenario) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "holding-defender",
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.defender,
      stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "advancing-enemy",
      archetype: "warrior",
      team: "enemy",
      cell: scenario.landmarks.attackerStart,
      stats: { hp: 200, damage: 4, rangeCells: 1, fireCooldownFrames: 60, movementFramesPerCell: WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "holding-defender",
      order: { type: "hold-position" },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "advancing-enemy",
      order: { type: "move", destination: scenario.landmarks.attackerDestination },
    }))) return;
    setPrimaryUnit("holding-defender");
    state.reloadDemo = loadHoldAttackDemo;
    refreshHUD();
  }

  function loadHoldSquareDemo(): void {
    const scenario = beginScenario("warrior-hold-square");
    if (!scenario) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "square-holder",
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.defender,
      stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30 },
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "square-passer",
      archetype: "warrior",
      team: "enemy",
      cell: scenario.landmarks.attackerStart,
      stats: { hp: 200, damage: 4, rangeCells: 1, fireCooldownFrames: 60, movementFramesPerCell: WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "square-holder",
      order: { type: "hold-position" },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "square-passer",
      order: { type: "move", destination: scenario.landmarks.attackerDestination },
    }))) return;
    setPrimaryUnit("square-holder");
    state.reloadDemo = loadHoldSquareDemo;
    refreshHUD();
  }

  function loadPursuitDemo(): void {
    const scenario = beginScenario("warrior-pursuit-square");
    if (!scenario) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "free-pursuer",
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.pursuer,
      stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL },
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "moving-runner",
      archetype: "warrior",
      team: "enemy",
      cell: scenario.landmarks.runnerStart,
      stats: { hp: 200 },
    }))) return;
    setPrimaryUnit("free-pursuer");
    state.reloadDemo = loadPursuitDemo;
    refreshHUD();
  }

  function loadPatrolAttackDemo(): void {
    const scenario = beginScenario("warrior-patrol-square");
    if (!scenario) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "patrolling-warrior",
      archetype: "warrior",
      team: "player",
      cell: scenario.landmarks.patrolStart,
      stats: { hp: 200, damage: 10, rangeCells: 1, fireCooldownFrames: 30, movementFramesPerCell: WARRIOR_DEMO_MOVEMENT_FRAMES_PER_CELL },
    }))) return;
    if (!unwrap(api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "patrol-target",
      archetype: "warrior",
      team: "enemy",
      cell: scenario.landmarks.target,
      stats: { hp: 200 },
    }))) return;
    if (!unwrap(api.issueTestOrder({
      unitId: "patrolling-warrior",
      order: { type: "patrol", endpoints: [scenario.landmarks.patrolStart, scenario.landmarks.patrolEnd] },
    }))) return;
    setPrimaryUnit("patrolling-warrior");
    state.reloadDemo = loadPatrolAttackDemo;
    refreshHUD();
  }

  function loadEmptyScenario(preset = presetSelect.value as TestScenarioPreset): void {
    const scenario = beginScenario(preset);
    if (!scenario) return;
    state.reloadDemo = () => loadEmptyScenario(preset);
    refreshHUD();
  }

  beginBtn.addEventListener("click", () => {
    loadEmptyScenario();
  });

  cleanupBtn.addEventListener("click", () => {
    cleanupActiveScenario();
    state.reloadDemo = null;
    refreshHUD();
  });

  loadPatrolBtn.addEventListener("click", loadPatrolDemo);
  loadMoveBtn.addEventListener("click", loadMoveDemo);
  loadHoldBtn.addEventListener("click", loadHoldDemo);
  loadMultiBtn.addEventListener("click", loadMultiUnitDemo);
  loadDenseBtn.addEventListener("click", loadDenseDemo);
  loadFollowBtn.addEventListener("click", loadFollowDemo);
  loadDetourBtn.addEventListener("click", loadDetourDemo);
  loadSpawnPointBtn.addEventListener("click", loadSpawnPointDemo);
  loadWarriorBtn.addEventListener("click", loadWarriorDemo);
  loadWarriorDuelBtn.addEventListener("click", loadWarriorDuelDemo);
  loadAutoMarchBtn.addEventListener("click", loadAutoMarchDemo);
  loadAutoMoveBtn.addEventListener("click", loadAutoMoveDemo);
  loadHoldAttackBtn.addEventListener("click", loadHoldAttackDemo);
  loadHoldSquareBtn.addEventListener("click", loadHoldSquareDemo);
  loadPursuitBtn.addEventListener("click", loadPursuitDemo);
  loadPatrolAttackBtn.addEventListener("click", loadPatrolAttackDemo);
  loadEmptyBtn.addEventListener("click", () => loadEmptyScenario());

  step1Btn.addEventListener("click", () => {
    if (!state.scenarioId) return;
    api.advanceTestFrames(state.scenarioId, 1);
    refreshHUD();
  });

  step10Btn.addEventListener("click", () => {
    if (!state.scenarioId) return;
    api.advanceTestFrames(state.scenarioId, 10);
    refreshHUD();
  });

  resetBtn.addEventListener("click", () => {
    const reload = state.reloadDemo;
    if (reload) reload();
  });

  stopBtn.addEventListener("click", () => {
    if (!state.primaryUnitId) return;
    stopPlayback();
    unwrap(api.issueTestOrder({ unitId: state.primaryUnitId, order: { type: "stop" } }));
    refreshHUD();
  });

  playBtn.addEventListener("click", () => {
    if (!state.scenarioId && !state.playing) {
      loadPatrolDemo();
      if (state.scenarioId) togglePlay();
      return;
    }
    togglePlay();
  });

  function togglePlay(): void {
    if (state.playing) {
      stopPlayback();
      return;
    }
    state.playing = !state.playing;
    playbackAccumulator = 0;
    playBtn.textContent = state.playing ? "⏸ Pause" : "▶ Play";
    if (state.playing) playLoop();
  }

  function playLoop(): void {
    if (!state.playing || !state.scenarioId) {
      frameHandle = null;
      return;
    }
    playbackAccumulator += Number(speedSelect.value);
    const frames = Math.floor(playbackAccumulator);
    if (frames > 0) {
      playbackAccumulator -= frames;
      api.advanceTestFrames(state.scenarioId, frames);
      refreshHUD();
    }
    frameHandle = requestAnimationFrame(playLoop);
  }

  window.addEventListener("pagehide", () => {
    state.playing = false;
    if (frameHandle !== null) cancelAnimationFrame(frameHandle);
    if (state.scenarioId) {
      api.cleanupScenario(state.scenarioId);
    }
  });

  return panel;
}

function createSection(title: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "debug-section";
  const h3 = document.createElement("h3");
  h3.textContent = title;
  div.appendChild(h3);
  return div;
}

function createButton(text: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.type = "button";
  return btn;
}
