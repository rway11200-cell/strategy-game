import type { GameTestApi, TestScenarioPreset } from "./GameTestApi";

const PRESETS = ["three-cell-patrol-corridor", "long-movement-corridor", "tower-placement"];

interface PanelState {
  scenarioId: string | null;
  playing: boolean;
}

export function createGameplayDebugPanel(api: GameTestApi): HTMLDivElement {
  const state: PanelState = { scenarioId: null, playing: false };

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
  const loadDemoBtn = createButton("Load patrol demo");
  demoSection.appendChild(loadDemoBtn);
  panel.appendChild(demoSection);

  const controlSection = createSection("Controls");
  const step1Btn = createButton("▶ 1 frame");
  const step10Btn = createButton("▶▶ 10 frames");
  const playBtn = createButton("▶ Play");
  playBtn.id = "play-btn";
  const resetBtn = createButton("⟲ Reset");
  resetBtn.style.backgroundColor = "#444";
  controlSection.appendChild(step1Btn);
  controlSection.appendChild(step10Btn);
  controlSection.appendChild(playBtn);
  controlSection.appendChild(resetBtn);
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
        const orderInfo = unit.order
          ? ` [${unit.order.type}] ${unit.order.status}${unit.order.completedCycles !== undefined ? ` cycles:${unit.order.completedCycles}` : ""}`
          : "";
        lines.push(`  ${unit.id} @ ${cell} hp:${unit.hp}/${unit.maxHp}${orderInfo}`);
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

  beginBtn.addEventListener("click", () => {
    const preset = presetSelect.value as TestScenarioPreset;
    const result = api.beginScenario({ preset, simulation: "manual" });
    if (result.ok) {
      state.scenarioId = result.value.id;
      cleanupBtn.disabled = false;
      refreshHUD();
    } else {
      hud.textContent = `Error: ${result.error.message}`;
    }
  });

  cleanupBtn.addEventListener("click", () => {
    if (!state.scenarioId) return;
    api.cleanupScenario(state.scenarioId);
    state.scenarioId = null;
    cleanupBtn.disabled = true;
    state.playing = false;
    playBtn.textContent = "▶ Play";
    refreshHUD();
  });

  loadDemoBtn.addEventListener("click", () => {
    if (state.scenarioId) {
      api.cleanupScenario(state.scenarioId);
      state.scenarioId = null;
    }
    const result = api.beginScenario({ preset: "three-cell-patrol-corridor", simulation: "manual" });
    if (!result.ok) {
      hud.textContent = `Error: ${result.error.message}`;
      return;
    }
    state.scenarioId = result.value.id;
    cleanupBtn.disabled = false;

    const scenario = result.value;
    const pointA = scenario.landmarks.start;
    const pointB = scenario.landmarks.end;
    const spawnResult = api.spawnTestUnit({
      scenarioId: scenario.id,
      id: "patrol-unit",
      archetype: "goblin",
      team: "enemy",
      cell: pointA,
    });
    if (!spawnResult.ok) {
      hud.textContent = `Error: ${spawnResult.error.message}`;
      return;
    }
    api.issueTestOrder({
      unitId: "patrol-unit",
      order: { type: "patrol", endpoints: [pointA, pointB] },
    });
    refreshHUD();
  });

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
    if (!state.scenarioId) return;
    api.cleanupScenario(state.scenarioId);
    state.scenarioId = null;
    cleanupBtn.disabled = true;
    state.playing = false;
    playBtn.textContent = "▶ Play";
    loadDemoBtn.click();
  });

  playBtn.addEventListener("click", () => {
    if (!state.scenarioId && !state.playing) {
      loadDemoBtn.click();
      setTimeout(() => { if (state.scenarioId) togglePlay(); }, 100);
      return;
    }
    togglePlay();
  });

  function togglePlay(): void {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? "⏸ Pause" : "▶ Play";
    if (state.playing) playLoop();
  }

  let frameHandle: number | null = null;

  function playLoop(): void {
    if (!state.playing || !state.scenarioId) {
      frameHandle = null;
      return;
    }
    api.advanceTestFrames(state.scenarioId, 1);
    refreshHUD();
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
