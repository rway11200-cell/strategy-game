import { TipoEnemigo } from "../../unidades/Enemigo";
import { EsperarAction } from "../acciones/EsperarAction";
import { EnemigosProps, GenerarEnemigosAccion } from "../acciones/GenerarEnemigosAccion";
import { GenerarEntidadesAccion } from "../acciones/GenerarEntidadesAccion";
import { NotificacionAccion } from "../acciones/NotificacionAction";
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

        case "notification":
          return new NotificacionAccion(evento.text);

        case "wave":
          return new GenerarEnemigosAccion(
            evento.path ?? "default",
            evento.interval ?? 300,
            evento.enemies.map((e): EnemigosProps => {
              switch (e.id) {
                case "Goblin":
                  return {
                    tipo: TipoEnemigo.Globlin,
                    cantidad: e.count,
                  };
                case "Esqueleto":
                  return {
                    tipo: TipoEnemigo.Esqueleto,
                    cantidad: e.count,
                  };
                case "Fantasma":
                  return {
                    tipo: TipoEnemigo.Fantasma,
                    cantidad: e.count,
                  };
              }

              return {
                tipo: TipoEnemigo.Globlin,
                cantidad: 10,
              };
            }),
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

  public getMonedas(): number {
    return this.levelJson.initialState.coins;
  }

  public getBackgroud(): string {
    return this.levelJson.background?.texture || "default.png";
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
