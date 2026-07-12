import { PointData } from "pixi.js";
import { randomFloat } from "../../engine/utils/random";
import { Unit } from "./unidades/Unit";

interface TargetFollowerFromPointsProps {
  points: PointData[];
  variation: number;
  loop?: boolean;
}

interface TargetFollowerFromContainerProps {
  units: Unit[];
  loop?: boolean;
}

type TargetProvider = () => PointData;

export class TargetFollower {
  private targets: TargetProvider[] = [];
  private units?: Unit[];
  private i = 0;
  private loop = false;
  public variation: number = 0;
  public onDestinationReached?: () => void;

  constructor() {}

  setRouteFromPoints({ points, variation = 0, loop = false }: TargetFollowerFromPointsProps) {
    this.variation = variation;
    this.targets = points.map((point): TargetProvider => {
      const pointWithVariation: PointData = {
        x: point.x + randomFloat(-variation, variation),
        y: point.y + randomFloat(-variation, variation),
      };

      return () => pointWithVariation;
    });
    this.i = 0;
    this.loop = loop;
  }

  setRouteFromUnits({ units, loop = false }: TargetFollowerFromContainerProps) {
    if (!units) {
      throw new Error("setRouteFromUnits called with empty units");
    }

    this.units = units;
    this.targets = units.map((unit): TargetProvider => {
      return () => {
        return {
          x: unit.position.x,
          y: unit.position.y,
        };
      };
    });
    this.i = 0;
    this.loop = loop;
  }

  get target(): PointData | undefined {
    const result = this.targets[this.i];
    if (!result) return;
    return result();
  }

  advanceToNextTarget() {
    if (!this.targets.length) return;
    this.i++;
    if (this.i >= this.targets.length) {
      this.i = this.loop ? 0 : this.targets.length - 1;
      this.onDestinationReached?.();
    }
  }

  get finished(): boolean {
    return !this.loop && this.targets.length > 0 && this.i === this.targets.length - 1;
  }

  reset() {
    this.i = 0;
  }

  public getOrigin(): PointData {
    if (!this.targets || this.targets.length === 0) {
      console.warn("TargetFollower.getOrigin: no targets defined");
      return { x: 0, y: 0 };
    }
    const result = this.targets[0];
    return result();
  }

  public getEnd(): PointData {
    if (!this.targets || this.targets.length === 0) {
      console.warn("TargetFollower.getEnd: no targets defined");
      return { x: 0, y: 0 };
    }
    const result = this.targets[this.targets.length - 1];
    return result();
  }

  public getFinalUnit(): Unit | undefined {
    if (!this.units || this.units.length === 0) {
      console.warn("TargetFollower.getFinalUnit: no units defined");
      return;
    }
    return this.units[this.units.length - 1];
  }
}
