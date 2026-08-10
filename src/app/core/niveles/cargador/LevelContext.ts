import type { GridIntegration } from "../../../../grid/GridIntegration";
import { UnitCreator } from "../../UnitCreator";
import { BaseTower } from "../../unidades/BaseTower";
import { Unit } from "../../unidades/Unit";
import { Projectile } from "../../unidades/Projectile";
import { Tower } from "../../unidades/Tower";
import { EntityDef, PathDef } from "./LevelSchema";

export class LevelContext {
  public gridIntegration: GridIntegration | null = null;

  constructor(
    public paths: PathDef[],
    public entities: EntityDef[],
    public coins: number,
    public showMessage: (message: string) => void,
    public unitCreator: UnitCreator<Unit>,
    public baseTowerCreator: UnitCreator<BaseTower>,
    public towerCreator: UnitCreator<Tower>,
    public projectileCreator: UnitCreator<Projectile>,
  ) {}
}
