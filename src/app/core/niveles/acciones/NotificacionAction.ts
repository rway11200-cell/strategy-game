import { ContextoNivel } from "../cargador/ContextoNivel";
import { AccionNivel } from "../cargador/ManejadorEventosNivel";

export class NotificacionAccion implements AccionNivel {
  constructor(private texto: string) {}
  getNombre(): string {
    return "NotificacionAction";
  }
  update(_: number, contexto: ContextoNivel): boolean {
    contexto.mostrarMensaje(this.texto);
    return true;
  }
}
