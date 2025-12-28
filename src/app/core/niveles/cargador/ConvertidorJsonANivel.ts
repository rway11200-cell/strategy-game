import { EsperarAction } from "../acciones/EsperarAction";
import { GenerarEnemigosAccion } from "../acciones/GenerarEnemigosAccion";
import { GenerarEntidadesAccion } from "../acciones/GenerarEntidadesAccion";
import { AccionNivel } from "./ManejadorEventosNivel";
import { EntityDef, LevelEvent, LevelJSON, PathDef } from "./SchemaNivel";

export class ConvertidorJsonANivel {
  constructor(private levelJson: LevelJSON) {}

  private parseActions(): AccionNivel[] {
    const timeline: LevelEvent[] = this.levelJson.timeline || [this.defaultTimeLine()];
    return timeline.map((evento) => {
      switch (evento.type) {
        case "wait":
          return new EsperarAction(evento.seconds);

        case "spawn_entities":
          return new GenerarEntidadesAccion();

        case "spawn":
          return new GenerarEnemigosAccion(
            evento.count,
            evento.interval ?? 300,
            evento.path ?? "default",
          );

        default:
          throw new Error(`Evento no soportado: ${evento.type}`);
      }
    });
  }

  public getCaminos(): PathDef[] {
    return this.levelJson.paths || [this.defaultPath()];
  }
  public getEntidades(): EntityDef[] {
    return this.levelJson.entities || [this.defaultEntity()];
  }
  public getAcciones(): AccionNivel[] {
    return this.parseActions();
  }

  private defaultTimeLine(): LevelEvent {
    return {
      type: "notification",
      text: "No hay eventos",
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
