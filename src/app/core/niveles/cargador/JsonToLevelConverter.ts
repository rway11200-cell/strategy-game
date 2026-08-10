import { UnitArchetype } from "../../unidades/UnitArchetype";
import { WaitAction } from "../acciones/WaitAction";
import { UnitSpawnProps, SpawnUnitsAction } from "../acciones/SpawnUnitsAction";
import { SpawnEntitiesAction } from "../acciones/SpawnEntitiesAction";
import { NotificationAction } from "../acciones/NotificationAction";
import { LevelAction } from "./LevelEventManager";
import { EntityDef, LevelEvent, LevelJSON, PathDef } from "./LevelSchema";

export class JsonToLevelConverter {
  constructor(private levelJson: LevelJSON) {}

  private parseActions(): LevelAction[] {
    const timeline: LevelEvent[] = this.levelJson.timeline || [this.defaultTimeline()];
    return timeline.map((event) => {
      switch (event.type) {
        case "wait":
          return new WaitAction(event.seconds);

        case "spawn_entities":
          return new SpawnEntitiesAction();

        case "notification":
          return new NotificationAction(event.text);

        case "wave":
            return new SpawnUnitsAction(
            event.path ?? "default",
            event.interval ?? 300,
            event.enemies.map((e): UnitSpawnProps => {
              switch (e.id) {
                case "Goblin":
                  return {
                    type: UnitArchetype.Goblin,
                    count: e.count,
                  };
                case "Skeleton":
                  return {
                    type: UnitArchetype.Skeleton,
                    count: e.count,
                  };
                case "Ghost":
                  return {
                    type: UnitArchetype.Ghost,
                    count: e.count,
                  };
              }

              return {
                type: UnitArchetype.Goblin,
                count: 10,
              };
            }),
          );

        default:
          throw new Error(`Event type not supported: ${event.type}`);
      }
    });
  }

  public getPaths(): PathDef[] {
    return this.levelJson.paths || [this.defaultPath()];
  }
  public getEntities(): EntityDef[] {
    return this.levelJson.entities || [this.defaultEntity()];
  }
  public getActions(): LevelAction[] {
    return this.parseActions();
  }

  public getCoins(): number {
    return this.levelJson.initialState.coins;
  }

  public getBackground(): string {
    return this.levelJson.background?.texture || "default.png";
  }

  private defaultTimeline(): LevelEvent {
    return {
      type: "notification",
      text: "No events",
    };
  }

  private defaultPath(): PathDef {
    return {
      id: "default",
      points: [
        { x: -300, y: 200 },
        { x: -200, y: 100 },
        { x: -100, y: -100 },
        { x: 200, y: 0 },
      ],
    };
  }
  private defaultEntity(): EntityDef {
    return {
      id: "default",
      type: "base_tower",
      x: 0,
      y: 0,
    };
  }
}
