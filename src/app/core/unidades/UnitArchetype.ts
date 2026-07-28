import type { ArmorType, AttackMode, UnitController, UnitTeam } from "./UnitSystem";
import type { ProjectileVisual } from "./Projectile";
import { type FramesJson, Unit } from "./Unit";

export enum UnitArchetype {
  Goblin = "goblin",
  Skeleton = "skeleton",
  Ghost = "ghost",
  Soldier = "soldier",
  Archer = "archer",
}

export interface UnitArchetypeDefinition {
  health: number;
  damage: number;
  speed: number;
  range: number;
  attackMode: AttackMode;
  framesJson: FramesJson;
  bounty: number;
  armorType: ArmorType;
  scale: number;
  projectileVisual?: ProjectileVisual;
}

const definitions: Record<UnitArchetype, UnitArchetypeDefinition> = {
  [UnitArchetype.Goblin]: {
    health: 50,
    damage: 6,
    speed: 0.6,
    range: 1,
    attackMode: "melee",
    bounty: 6,
    armorType: "unarmored",
    scale: 1,
    framesJson: {
      idle: "goblin scout - silhouette all animations-idle.json",
      run: "goblin scout - silhouette all animations-run.json",
      dead: "goblin scout - silhouette all animations-death 1.json",
    },
  },
  [UnitArchetype.Skeleton]: {
    health: 600,
    damage: 14,
    speed: 0.5,
    range: 1,
    attackMode: "melee",
    bounty: 50,
    armorType: "heavy",
    scale: 1,
    framesJson: {
      idle: "esqueleton-idle.json",
      run: "esqueleton-run.json",
      dead: "esqueleton-dead.json",
    },
  },
  [UnitArchetype.Ghost]: {
    health: 70,
    damage: 8,
    speed: 1.2,
    range: 1,
    attackMode: "melee",
    bounty: 15,
    armorType: "light",
    scale: 1,
    framesJson: {
      idle: "fantasma-idle.json",
      run: "fantasma-run.json",
      dead: "fantasma-dead.json",
    },
  },
  [UnitArchetype.Soldier]: {
    health: 100,
    damage: 12,
    speed: 0.7,
    range: 1,
    attackMode: "melee",
    bounty: 10,
    armorType: "light",
    scale: 1 / 3,
    framesJson: {
      idle: "warrior-idle.json",
      run: "warrior-run.json",
      attack: "warrior-attack.json",
    },
  },
  [UnitArchetype.Archer]: {
    health: 80,
    damage: 20,
    speed: 0.8,
    range: 3,
    attackMode: "projectile",
    bounty: 20,
    armorType: "light",
    scale: 1 / 2,
    framesJson: { idle: "archer-idle.json", attack: "archer-attack.json" },
    projectileVisual: {
      framesJson: { idle: "archer-arrow.json" },
      scale: 0.6,
      flipTowardTarget: true,
    },
  },
};

export function getUnitArchetypeDefinition(archetype: UnitArchetype): UnitArchetypeDefinition {
  return definitions[archetype];
}

export function initializeUnitArchetype(
  unit: Unit,
  archetype: UnitArchetype,
  options?: { team?: UnitTeam; controller?: UnitController },
): void {
  const definition = getUnitArchetypeDefinition(archetype);
  unit.initializeAnimation(definition.framesJson);
  unit.initializeHealthBar(definition.health);
  unit.initializeSpeed(definition.speed);
  unit.model.configure({
    damage: definition.damage,
    range: definition.range,
    attackMode: definition.attackMode,
    armorType: definition.armorType,
    team: options?.team,
    controller: options?.controller,
  });
  unit.archetype = archetype;
  unit.bounty = definition.bounty;
  unit.projectileVisual = definition.projectileVisual;
  unit.scale.set(definition.scale);
}
