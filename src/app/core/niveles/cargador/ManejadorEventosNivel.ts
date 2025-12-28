import { Ticker } from "pixi.js";
import { ContextoNivel } from "./ContextoNivel";
import { ConvertidorJsonANivel } from "./ConvertidorJsonANivel";

export interface AccionNivel {
  getNombre(): string;
  update(tiempoJuegoMS: number, contexto: ContextoNivel): boolean;
}

export class ManejadorEventosNivel {
  private index = 0;
  private acciones: AccionNivel[];

  constructor(levelParcer: ConvertidorJsonANivel) {
    this.acciones = levelParcer.getAcciones();
  }

  update(_time: Ticker, context: ContextoNivel) {
    const tiempoJuegoMS = _time.lastTime;

    const accion = this.acciones[this.index];
    if (!accion) return;
    const terminada = accion.update(tiempoJuegoMS, context);
    if (terminada) {
      this.index++;
    }
  }
}
