import { expect, test } from "./support/GameTestFixture";
import { getUnit } from "./support/GameTestDriver";

const combatants = [
  { id: "team-a-1", team: "player", hp: 30, damage: 40, defense: 5 },
  { id: "team-a-2", team: "player", hp: 100, damage: 30, defense: 10 },
  { id: "team-a-3", team: "player", hp: 100, damage: 20, defense: 0 },
  { id: "team-b-1", team: "enemy", hp: 30, damage: 50, defense: 5 },
  { id: "team-b-2", team: "enemy", hp: 100, damage: 25, defense: 10 },
  { id: "team-b-3", team: "enemy", hp: 100, damage: 10, defense: 5 },
] as const;

test("tres unidades por equipo resuelven sus ataques en el mismo frame", async ({ game }) => {
  const setup =
    await test.step("Dado dos equipos completos antes del frame de combate", async () => {
      await game.open();
      await game.waitUntilReady();
      const scenario = await game.beginScenario("simultaneous-combat-3v3", {
        friendlyFire: false,
      });
      const teamACells = game.group(scenario, "teamA");
      const teamBCells = game.group(scenario, "teamB");
      expect(teamACells).toHaveLength(3);
      expect(teamBCells).toHaveLength(3);

      for (const [index, unit] of combatants.entries()) {
        const teamIndex = index % 3;
        await game.spawnUnit({
          scenarioId: scenario.id,
          id: unit.id,
          archetype: "test-combat-unit",
          team: unit.team,
          cell: unit.team === "player" ? teamACells[teamIndex] : teamBCells[teamIndex],
          stats: { hp: unit.hp, damage: unit.damage, defense: unit.defense },
        });
      }
      return scenario;
    });

  await test.step("Cuando los seis ataques se comprometen simultáneamente", async () => {
    const attacks = [
      { attackerId: "team-a-1", targetId: "team-b-1" },
      { attackerId: "team-a-2", targetId: "team-b-2" },
      { attackerId: "team-a-3", targetId: "team-b-3" },
      { attackerId: "team-b-1", targetId: "team-a-1" },
      { attackerId: "team-b-2", targetId: "team-a-2" },
      { attackerId: "team-b-3", targetId: "team-a-3" },
    ];
    const result = await game.resolveCombatFrame(setup.id, attacks);

    expect(result.events.filter((event) => event.type === "damage.applied")).toHaveLength(6);
    expect(getUnit(result.snapshot, "team-a-1")).toMatchObject({ hp: 0, lifecycle: "dead" });
    expect(getUnit(result.snapshot, "team-b-1")).toMatchObject({ hp: 0, lifecycle: "dead" });
    expect(getUnit(result.snapshot, "team-a-2").hp).toBe(85);
    expect(getUnit(result.snapshot, "team-b-2").hp).toBe(80);
    expect(getUnit(result.snapshot, "team-a-3").hp).toBe(90);
    expect(getUnit(result.snapshot, "team-b-3").hp).toBe(85);
    expect(new Set(result.events.map((event) => event.frame))).toEqual(
      new Set([result.snapshot.frame]),
    );
    expect(result.snapshot.errors).toEqual([]);
  });
});
