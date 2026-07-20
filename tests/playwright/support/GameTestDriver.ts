import type { Page } from "@playwright/test";
import type {
  AdvanceTestCondition,
  AdvanceTestResult,
  ApiResult,
  BootTestSnapshot,
  CleanupScenarioResult,
  ScenarioTestSnapshot,
  ScenarioTestState,
  TestEventSnapshot,
  TestOrderSnapshot,
  TestScenarioPreset,
  TestUnitSnapshot,
  TestUnitTeam,
  TestWaveSnapshot,
} from "../../../src/app/testing/GameTestApi";
import type { CellCoord } from "../../../src/grid/GridConfig";

function unwrap<T>(operation: string, result: ApiResult<T>): T {
  if (result.ok) return result.value;
  const details = result.error.details ? ` ${JSON.stringify(result.error.details)}` : "";
  throw new Error(
    `GameTestApi.${operation} failed [${result.error.code}]: ${result.error.message}${details}`,
  );
}

export class GameTestDriver {
  private readonly scenarioIds = new Set<string>();

  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto("/__test__/gameplay/");
    await this.page.waitForFunction(() => {
      const root = document.querySelector<HTMLElement>("[data-testid='game-test-root']");
      return root?.dataset.state === "ready" || root?.dataset.state === "error";
    });

    const harness = await this.page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("[data-testid='game-test-root']");
      return {
        kind: root?.dataset.harness,
        state: root?.dataset.state,
        error: root?.dataset.error,
      };
    });
    if (harness.kind !== "strategy-game-playwright" || harness.state !== "ready") {
      throw new Error(
        `Gameplay test harness failed to boot: ${harness.error ?? `state=${harness.state}`}`,
      );
    }
  }

  async waitUntilReady(timeout = 15_000): Promise<void> {
    await this.page.waitForFunction(
      () => typeof window.__GAME_TEST__?.isReady === "function" && window.__GAME_TEST__.isReady(),
      undefined,
      { timeout },
    );
  }

  async getBootSnapshot(): Promise<BootTestSnapshot> {
    return this.page.evaluate(() => window.__GAME_TEST__!.getBootSnapshot());
  }

  async beginScenario(
    preset: TestScenarioPreset,
    options: { seed?: number; friendlyFire?: boolean } = {},
  ): Promise<ScenarioTestState> {
    const result = await this.page.evaluate(
      ({ scenarioPreset, scenarioOptions }) =>
        window.__GAME_TEST__!.beginScenario({
          preset: scenarioPreset,
          simulation: "manual",
          ...scenarioOptions,
        }),
      { scenarioPreset: preset, scenarioOptions: options },
    );
    const scenario = unwrap("beginScenario", result);
    this.scenarioIds.add(scenario.id);
    return scenario;
  }

  point(scenario: ScenarioTestState, name: string): CellCoord {
    const point = scenario.landmarks[name];
    if (!point) throw new Error(`Scenario "${scenario.preset}" does not define landmark "${name}"`);
    return point;
  }

  group(scenario: ScenarioTestState, name: string): CellCoord[] {
    const group = scenario.groups[name];
    if (!group) throw new Error(`Scenario "${scenario.preset}" does not define group "${name}"`);
    return group;
  }

  async spawnUnit(options: {
    scenarioId: string;
    id: string;
    archetype: string;
    team: TestUnitTeam;
    cell: CellCoord;
    stats?: {
      hp?: number;
      damage?: number;
      defense?: number;
      rangeCells?: number;
      movementFramesPerCell?: number;
      fireCooldownFrames?: number;
    };
  }): Promise<TestUnitSnapshot> {
    const result = await this.page.evaluate(
      (spawnOptions) => window.__GAME_TEST__!.spawnTestUnit(spawnOptions),
      options,
    );
    return unwrap("spawnTestUnit", result);
  }

  async issueOrder(
    unitId: string,
    order:
      | { type: "move"; destination: CellCoord }
      | { type: "stop" }
      | { type: "hold-position" }
      | { type: "patrol"; endpoints: readonly [CellCoord, CellCoord] }
      | { type: "attack"; targetId: string },
  ): Promise<TestOrderSnapshot> {
    const result = await this.page.evaluate(
      ({ activeUnitId, requestedOrder }) =>
        window.__GAME_TEST__!.issueTestOrder({ unitId: activeUnitId, order: requestedOrder }),
      { activeUnitId: unitId, requestedOrder: order },
    );
    return unwrap("issueTestOrder", result);
  }

  async snapshot(scenarioId: string): Promise<ScenarioTestSnapshot> {
    return this.page.evaluate(
      (activeScenarioId) => window.__GAME_TEST__!.getScenarioSnapshot(activeScenarioId),
      scenarioId,
    );
  }

  async advanceUntil(options: {
    scenarioId: string;
    condition: AdvanceTestCondition;
    maxFrames?: number;
    afterSequence?: number;
  }): Promise<AdvanceTestResult> {
    const result = await this.page.evaluate(
      ({ scenarioId, condition, maxFrames, afterSequence }) =>
        window.__GAME_TEST__!.advanceTestSimulation({
          scenarioId,
          condition,
          maxFrames,
          afterSequence,
        }),
      {
        scenarioId: options.scenarioId,
        condition: options.condition,
        maxFrames: options.maxFrames ?? 500,
        afterSequence: options.afterSequence,
      },
    );
    return unwrap("advanceTestSimulation", result);
  }

  async advanceFrames(scenarioId: string, frames: number): Promise<ScenarioTestSnapshot> {
    const result = await this.page.evaluate(
      ({ activeScenarioId, frameCount }) =>
        window.__GAME_TEST__!.advanceTestFrames(activeScenarioId, frameCount),
      { activeScenarioId: scenarioId, frameCount: frames },
    );
    return unwrap("advanceTestFrames", result);
  }

  async placeTower(options: {
    scenarioId: string;
    id: string;
    archetype: string;
    cell: CellCoord;
  }): Promise<{ tower: TestUnitSnapshot; cost: number }> {
    const result = await this.page.evaluate(
      (placement) => window.__GAME_TEST__!.placeTestTower(placement),
      options,
    );
    return unwrap("placeTestTower", result);
  }

  async startWave(
    scenarioId: string,
    wave: number,
  ): Promise<{ wave: TestWaveSnapshot; path: CellCoord[] }> {
    const result = await this.page.evaluate(
      ({ activeScenarioId, waveNumber }) =>
        window.__GAME_TEST__!.startTestWave({ scenarioId: activeScenarioId, wave: waveNumber }),
      { activeScenarioId: scenarioId, waveNumber: wave },
    );
    return unwrap("startTestWave", result);
  }

  async applyDamage(options: {
    scenarioId: string;
    sourceId?: string;
    targetId: string;
    amount: number;
  }): Promise<{ event: TestEventSnapshot; snapshot: ScenarioTestSnapshot }> {
    const result = await this.page.evaluate(
      (damage) => window.__GAME_TEST__!.applyTestDamage(damage),
      options,
    );
    return unwrap("applyTestDamage", result);
  }

  async resolveCombatFrame(
    scenarioId: string,
    attacks: Array<{ attackerId: string; targetId: string }>,
  ): Promise<{ events: TestEventSnapshot[]; snapshot: ScenarioTestSnapshot }> {
    const result = await this.page.evaluate(
      ({ activeScenarioId, declaredAttacks }) =>
        window.__GAME_TEST__!.resolveTestCombatFrame({
          scenarioId: activeScenarioId,
          attacks: declaredAttacks,
        }),
      { activeScenarioId: scenarioId, declaredAttacks: attacks },
    );
    return unwrap("resolveTestCombatFrame", result);
  }

  async cleanup(scenarioId: string): Promise<CleanupScenarioResult> {
    const result = await this.page.evaluate(
      (activeScenarioId) => window.__GAME_TEST__!.cleanupScenario(activeScenarioId),
      scenarioId,
    );
    const cleanup = unwrap("cleanupScenario", result);
    this.scenarioIds.delete(scenarioId);
    return cleanup;
  }

  async cleanupStartedScenarios(): Promise<void> {
    const failures: Error[] = [];
    for (const scenarioId of [...this.scenarioIds]) {
      try {
        await this.cleanup(scenarioId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(new Error(`Failed to clean scenario "${scenarioId}": ${message}`));
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `One or more Playwright scenarios could not be cleaned:\n${failures
          .map((failure) => failure.message)
          .join("\n")}`,
      );
    }
  }
}

export function getUnit(snapshot: ScenarioTestSnapshot, unitId: string): TestUnitSnapshot {
  const unit = snapshot.units.find((candidate) => candidate.id === unitId);
  if (!unit)
    throw new Error(`Snapshot at frame ${snapshot.frame} does not contain unit "${unitId}"`);
  return unit;
}

export function eventsOfType(snapshot: ScenarioTestSnapshot, type: string): TestEventSnapshot[] {
  return snapshot.events.filter((event) => event.type === type);
}
