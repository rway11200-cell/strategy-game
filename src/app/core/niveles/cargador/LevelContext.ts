import { UnitCreator } from "../../UnitCreator";
import { BaseTower } from "../../unidades/BaseTower";
import { Enemy } from "../../unidades/Enemy";
import { Projectile } from "../../unidades/Projectile";
import { Tower } from "../../unidades/Tower";
import { EntityDef, PathDef } from "./LevelSchema";

export class LevelContext {
  constructor(
    public paths: PathDef[],
    public entities: EntityDef[],
    public coins: number,
    public showMessage: (message: string) => void,
    public enemyCreator: UnitCreator<Enemy>,
    public baseTowerCreator: UnitCreator<BaseTower>,
    public towerCreator: UnitCreator<Tower>,
    public projectileCreator: UnitCreator<Projectile>,
  ) {}
}
