import type { PointData } from "pixi.js";

export type UnitTeam = "player" | "enemy" | "neutral";
export type UnitFaction = UnitTeam;
export type UnitState = "idle" | "moving" | "pursuing" | "attacking" | "holding" | "blocked" | "dead";
export type UnitController = "player" | "ai";
export type AttackMode = "none" | "melee" | "projectile";

export interface UnitSystemOptions {
  hp?: number;
  maxHp?: number;
  damage?: number;
  speed?: number;
  range?: number;
  vision?: number;
  team?: UnitTeam;
  faction?: UnitFaction;
  state?: UnitState;
  controller?: UnitController;
  position?: PointData;
  attackMode?: AttackMode;
  cooldown?: number;
}

export interface UnitStats {
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  range: number;
  vision: number;
}

export class UnitSystem {
  public hp: number;
  public maxHp: number;
  public damage: number;
  public speed: number;
  public range: number;
  public vision: number;
  public team: UnitTeam;
  public state: UnitState;
  public controller: UnitController;
  public attackMode: AttackMode;
  public cooldown: number;
  public readonly position: PointData;

  constructor(options: UnitSystemOptions = {}) {
    const maxHp = Math.max(0, options.maxHp ?? options.hp ?? 100);
    this.maxHp = maxHp;
    this.hp = Math.max(0, Math.min(options.hp ?? maxHp, maxHp));
    this.damage = Math.max(0, options.damage ?? 0);
    this.speed = Math.max(0, options.speed ?? 1);
    this.range = Math.max(0, options.range ?? 0);
    this.vision = Math.max(0, options.vision ?? 6);
    this.team = options.team ?? options.faction ?? "player";
    this.state = options.state ?? "idle";
    this.controller = options.controller ?? (this.team === "enemy" ? "ai" : "player");
    this.attackMode = options.attackMode ?? "none";
    this.cooldown = Math.max(0, options.cooldown ?? 0);
    this.position = options.position ?? { x: 0, y: 0 };
  }

  get faction(): UnitFaction {
    return this.team;
  }

  set faction(faction: UnitFaction) {
    this.team = faction;
  }

  get stats(): UnitStats {
    return {
      hp: this.hp,
      maxHp: this.maxHp,
      damage: this.damage,
      speed: this.speed,
      range: this.range,
      vision: this.vision,
    };
  }

  get canAttack(): boolean {
    return this.attackMode !== "none" && this.damage > 0;
  }

  configure(options: UnitSystemOptions): void {
    if (options.maxHp !== undefined || options.hp !== undefined) {
      this.maxHp = Math.max(0, options.maxHp ?? options.hp ?? this.maxHp);
      this.hp = Math.max(0, Math.min(options.hp ?? this.maxHp, this.maxHp));
    }
    if (options.damage !== undefined) this.damage = Math.max(0, options.damage);
    if (options.speed !== undefined) this.speed = Math.max(0, options.speed);
    if (options.range !== undefined) this.range = Math.max(0, options.range);
    if (options.vision !== undefined) this.vision = Math.max(0, options.vision);
    if (options.team !== undefined || options.faction !== undefined) {
      this.team = options.team ?? options.faction ?? this.team;
    }
    if (options.state !== undefined) this.state = options.state;
    if (options.controller !== undefined) this.controller = options.controller;
    if (options.attackMode !== undefined) this.attackMode = options.attackMode;
    if (options.cooldown !== undefined) this.cooldown = Math.max(0, options.cooldown);
  }

  reset(): void {
    this.hp = this.maxHp;
    this.state = "idle";
  }

  takeDamage(amount: number): number {
    if (this.state === "dead" || amount <= 0) return this.hp;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.state = "dead";
    return this.hp;
  }

  isHostileTo(other: UnitSystem): boolean {
    return this.team !== "neutral" && other.team !== "neutral" && this.team !== other.team;
  }
}
