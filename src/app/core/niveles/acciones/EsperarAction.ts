import { ContextoNivel } from "../cargador/ContextoNivel";
import { AccionNivel } from "../cargador/ManejadorEventosNivel";

export class EsperarAction implements AccionNivel {
  private tiempoInicial?: number;
  private segundosAEsperar: number;
  constructor(segundosAEsperar: number) {
    this.segundosAEsperar = segundosAEsperar;
  }
  getNombre(): string {
    return "EsperarAction";
  }
  update(tiempoJuegoMS: number, _: ContextoNivel): boolean {
    if (!this.tiempoInicial) {
      this.tiempoInicial = tiempoJuegoMS;
      return false;
    }

    const milisegundosAEsperar = this.segundosAEsperar * 1000;
    if (tiempoJuegoMS - this.tiempoInicial < milisegundosAEsperar) {
      return false;
    }

    return true;
  }
}
