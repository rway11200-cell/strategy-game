import { PointData } from "pixi.js";
import { randomFloat } from "../../engine/utils/random";
import { type CellCoord, gridToWorld, type GridConfig } from "../../grid/GridConfig";
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

interface TargetFollowerFromCellsProps {
  cells: CellCoord[];
  gridConfig: GridConfig;
  loop?: boolean;
}

type TargetProvider = () => PointData;

export class TargetFollower {
  private targets: TargetProvider[] = [];
  private cells?: CellCoord[];
  private units?: Unit[];
  private i = 0;
  private loop = false;
  private completed = false;
  public variation: number = 0;
  public onDestinationReached?: () => void;

  constructor() {}

  setRouteFromPoints({ points, variation = 0, loop = false }: TargetFollowerFromPointsProps) {
    this.cells = undefined;
    this.units = undefined;
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
    this.completed = false;
  }

  setRouteFromUnits({ units, loop = false }: TargetFollowerFromContainerProps) {
    if (!units) {
      throw new Error("setRouteFromUnits called with empty units");
    }

    this.cells = undefined;
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
    this.completed = false;
  }

  setRouteFromCells({ cells, gridConfig, loop = false }: TargetFollowerFromCellsProps) {
    this.units = undefined;
    this.cells = cells.map((cell) => ({ ...cell }));
    this.targets = this.cells.map((cell) => () => gridToWorld(cell.col, cell.row, gridConfig));
    this.i = 0;
    this.loop = loop;
    this.completed = false;
  }

  get target(): PointData | undefined {
    if (this.completed) return;
    const result = this.targets[this.i];
    if (!result) return;
    return result();
  }

  get targetCell(): CellCoord | undefined {
    if (this.completed) return;
    return this.cells?.[this.i];
  }

  advanceToNextTarget(): boolean {
    if (!this.targets.length || this.completed) return false;
    this.i++;
    if (this.i >= this.targets.length) {
      if (this.loop) {
        this.i = 0;
      } else {
        this.completed = true;
        this.onDestinationReached?.();
      }
      return true;
    }
    return false;
  }

  get finished(): boolean {
    return !this.loop && this.completed;
  }

  reset() {
    this.i = 0;
    this.completed = false;
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
