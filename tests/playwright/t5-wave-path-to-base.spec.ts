import { expect, test } from "./support/GameTestFixture";

test("una oleada completa recorre la ruta y alcanza la base", async ({ game }) => {
  const setup =
    await test.step("Dado un nivel aislado con una ruta única hasta la base", async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("single-wave-path-to-base", { seed: 1 });
      expect(scenario.path.length).toBeGreaterThan(2);
      expect(scenario.expectedUnitCount).toBeGreaterThan(0);
      return scenario;
    });

  const started = await test.step("Cuando comienza la primera oleada", async () => {
    const result = await game.startWave(setup.id, 1);
    expect(result.wave).toMatchObject({
      number: 1,
      status: "running",
      spawnedCount: 0,
      reachedBaseCount: 0,
    });
    expect(result.path).toEqual(setup.path);
    expect(result.wave.unitIds).toHaveLength(setup.expectedUnitCount!);
    return result;
  });

  await test.step("Entonces todas las unidades llegan una vez siguiendo celdas adyacentes", async () => {
    const completed = await game.advanceUntil({
      scenarioId: setup.id,
      condition: { type: "wave-status", waveId: started.wave.id, status: "completed" },
      maxFrames: 5_000,
    });
    const wave = completed.snapshot.wave;

    expect(wave).toMatchObject({
      id: started.wave.id,
      status: "completed",
      spawnedCount: setup.expectedUnitCount,
      reachedBaseCount: setup.expectedUnitCount,
    });

    for (const unitId of started.wave.unitIds) {
      const enteredCells = completed.snapshot.events
        .filter((event) => event.type === "unit.entered-cell" && event.unitId === unitId)
        .map((event) => event.to);
      const baseReached = completed.snapshot.events.filter(
        (event) => event.type === "base.reached" && event.unitId === unitId,
      );

      expect(enteredCells, `${unitId} must follow the complete configured path`).toEqual(
        setup.path.slice(1),
      );
      expect(baseReached, `${unitId} must reach the base exactly once`).toHaveLength(1);
    }
    expect(completed.snapshot.cells.filter((cell) => cell.occupied)).toEqual([]);
    expect(completed.snapshot.errors).toEqual([]);
  });
});
