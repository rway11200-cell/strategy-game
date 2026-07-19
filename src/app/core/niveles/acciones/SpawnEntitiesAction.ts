import { engine } from "../../../getEngine";
import { worldToGrid } from "../../../../grid/GridConfig";
import { LevelContext } from "../cargador/LevelContext";
import { LevelAction } from "../cargador/LevelEventManager";

export class SpawnEntitiesAction implements LevelAction {
  getName(): string {
    return "SpawnEntitiesAction";
  }

  update(_: number, context: LevelContext): boolean {
    context.entities.forEach((entity) => {
      switch (entity.type) {
        case "base_tower": {
          const baseTower = context.baseTowerCreator.get();
          baseTower.position = { x: entity.x, y: entity.y };
          baseTower.spawn();

          baseTower.on("pointerdown", () => {
            if (baseTower.built === true) {
              context.showMessage("A tower already exists here");
              return;
            }
            if (context.coins < 100) {
              context.showMessage("Not enough coins");
              return;
            }

            const tower = context.towerCreator.get();
            if (context.gridIntegration) {
              const gridConfig = context.gridIntegration.gridConfig;
              const cell = worldToGrid(baseTower.position.x, baseTower.position.y, gridConfig);
              tower.setGridPosition(cell.x, cell.y, gridConfig);
            } else {
              tower.position = baseTower.position;
            }
            tower.spawn();

            baseTower.built = true;
            if (baseTower.built === true) {
              context.coins -= 100;
            }
            engine().audio.sfx.play("main/sounds/sfx-hover.wav", { volume: 0.6 });
          });
          break;
        }
      }
    });

    return true;
  }
}
