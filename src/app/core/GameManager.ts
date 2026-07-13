import { Assets, Container, Ticker } from "pixi.js";
import { createGridConfig } from "../../core/grid/GridConfig";
import { type CellCoord } from "../../grid/GridConfig";
import { type GridIntegrationConfig, GridIntegration } from "../../grid/GridIntegration";
import { CoinsUI } from "../ui/game/CoinsUI";
import { NotificationsUI } from "../ui/game/NotificationsUI";
import { devToolDrawPoints } from "../utils/devTools";
import { UnitCreator } from "./UnitCreator";
import { LevelContext } from "./niveles/cargador/LevelContext";
import { JsonToLevelConverter } from "./niveles/cargador/JsonToLevelConverter";
import { LevelEventManager } from "./niveles/cargador/LevelEventManager";
import { LevelJSON } from "./niveles/cargador/LevelSchema";
import { BaseTower } from "./unidades/BaseTower";
import { Enemy } from "./unidades/Enemy";
import { Projectile } from "./unidades/Projectile";
import { Tower } from "./unidades/Tower";
import { Unit } from "./unidades/Unit";

export class GameManager {
  private mainGameContainer: Container;
  private levelEventHandler: LevelEventManager;

  private gameContext: LevelContext;

  private coinsUI: CoinsUI;

  constructor(
    mainContainerScreen: Container,
    coinsUI: CoinsUI,
    notificaciones: NotificationsUI,
    assignBackground: (backgroundImage: string) => void,
  ) {
    this.mainGameContainer = mainContainerScreen;
    this.coinsUI = coinsUI;

    const jsonLevel = Assets.get<LevelJSON>("level_01.json");
    const levelStructure = new JsonToLevelConverter(jsonLevel);

    assignBackground(levelStructure.getBackground());

    this.gameContext = this.createGameContext(levelStructure, notificaciones);

    const gridPathDef = levelStructure.getPaths().find((p) => p.grid);
    if (gridPathDef?.grid) {
      const gridConfig = createGridConfig({ gridWidth: 25, gridHeight: 19, cellSize: 64 });
      const gridConfig2: GridIntegrationConfig = {
        gridConfig,
        spawn: { col: gridPathDef.grid.spawnCol, row: gridPathDef.grid.spawnRow },
        base: { col: gridPathDef.grid.baseCol, row: gridPathDef.grid.baseRow },
        blockedCells: this.buildBlockedCells(levelStructure),
      };
      this.gameContext.gridIntegration = new GridIntegration(gridConfig2);
    } else {
      this.gameContext.paths.forEach((pathDef) => {
        devToolDrawPoints(this.mainGameContainer, pathDef.points, "red", 15);
      });
    }

    this.levelEventHandler = new LevelEventManager(levelStructure);
  }

  private buildBlockedCells(levelStructure: JsonToLevelConverter): CellCoord[] {
    return levelStructure.getEntities().flatMap((e) => {
      if (e.type === "base_tower") {
        const col = Math.floor(e.x / 64);
        const row = Math.floor(e.y / 64);
        return [{ col, row }];
      }
      return [];
    });
  }

  private createGameContext(
    levelStructure: JsonToLevelConverter,
    notificaciones: NotificationsUI,
  ): LevelContext {
    const projectileCreator = new UnitCreator<Projectile>({
      container: this.mainGameContainer,
      initialPoolSize: 10,
      factory: () => {
        return new Projectile(this.mainGameContainer);
      },
    });

    return {
      gridIntegration: null,
      paths: levelStructure.getPaths(),
      entities: levelStructure.getEntities(),
      coins: levelStructure.getCoins(),
      showMessage: (message) => {
        notificaciones.notify(message);
      },
      projectileCreator: projectileCreator,
      enemyCreator: new UnitCreator<Enemy>({
        container: this.mainGameContainer,
        initialPoolSize: 10,
        factory: () => {
          const newEnemy = new Enemy(this.mainGameContainer);
          newEnemy.onDestroy = () => {
            this.removeAsProjectileTarget(newEnemy);
            this.gameContext.coins += newEnemy.getDeathReward();
          };
          return newEnemy;
        },
      }),
      towerCreator: new UnitCreator<Tower>({
        container: this.mainGameContainer,
        initialPoolSize: 10,
        factory: () => {
          return new Tower(this.mainGameContainer, {
            shootOptions: {
              range: 150,
              damage: 20,
              fireRate: 0.5,
              projectileCreator: projectileCreator,
            },
          });
        },
      }),
      baseTowerCreator: new UnitCreator<BaseTower>({
        container: this.mainGameContainer,
        initialPoolSize: 10,
        factory: () => {
          return new BaseTower(this.mainGameContainer);
        },
      }),
    };
  }

  private removeAsProjectileTarget = (unit: Unit) => {
    const activeProjectiles = this.gameContext.projectileCreator.getUnits();
    activeProjectiles.forEach((projectile) => {
      if (projectile.targetFollower?.getFinalUnit() === unit) {
        projectile.destroy();
      }
    });
  };

  public update(_time: Ticker) {
    this.levelEventHandler.update(_time, this.gameContext);

    this.coinsUI.setCoins(this.gameContext.coins);

    this.gameContext.enemyCreator.update(_time);
    this.gameContext.towerCreator.update(_time);
    this.gameContext.projectileCreator.update(_time);
  }
}
