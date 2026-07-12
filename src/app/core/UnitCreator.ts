import { Container, Ticker } from "pixi.js";
import { Unit } from "./unidades/Unit";

interface UnitCreatorProps<T extends Unit> {
  container: Container;
  initialPoolSize: number;
  factory: () => T;
}

export class UnitCreator<T extends Unit> {
  private units: T[];
  private container: Container;
  factory: () => T;

  constructor({ container, factory, initialPoolSize }: UnitCreatorProps<T>) {
    this.container = container;
    this.factory = factory;

    this.units = [];
    for (let i = 0; i < initialPoolSize; i++) {
      const newUnit = this.createAndRegisterUnit();
      this.units.push(newUnit);
      this.container.addChild(newUnit);
    }
  }

  private createAndRegisterUnit(): T {
    const unit = this.factory();
    unit.active = false;
    unit.visible = false;

    this.container.addChild(unit);
    return unit;
  }

  public get(active: boolean = false): T {
    const free = this.units.find((i) => !i.active);
    if (free) {
      if (active) free.spawn();
      return free;
    }

    const newUnit = this.createAndRegisterUnit();
    this.units.push(newUnit);
    if (active) newUnit.spawn();
    return newUnit;
  }

  public getUnits(active: boolean = false): T[] {
    if (active) {
      return this.units.filter((unit) => unit.active);
    }

    return this.units;
  }

  public applyToAllUnits(actionToApply: (t: T) => void) {
    const units = this.getUnits();
    units.forEach((unit) => actionToApply(unit));
  }
  public update(_time: Ticker) {
    this.units.forEach((unit) => {
      if (unit.active) {
        unit.update(_time);
      }
    });
  }
}
