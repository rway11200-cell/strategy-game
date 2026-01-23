import { TipoEnemigo } from "../../unidades/Enemigo";
import { ContextoNivel } from "../cargador/ContextoNivel";
import { AccionNivel } from "../cargador/ManejadorEventosNivel";
import { PathDef } from "../cargador/SchemaNivel";

export type EnemigosProps = {
  tipo: TipoEnemigo;
  cantidad: number;
};
export class GenerarEnemigosAccion implements AccionNivel {
  private tiempoInicial?: number;
  private enemigosAGenerar: TipoEnemigo[] = [];
  constructor(
    private camino: string,
    private inverval: number,
    enemigos: EnemigosProps[],
  ) {
    enemigos.forEach((e) => {
      for (let i = 0; i < e.cantidad; i++) {
        this.enemigosAGenerar.push(e.tipo);
      }
    });

    // mezclar
    this.enemigosAGenerar.sort(() => Math.random() - 0.5);
  }

  getNombre(): string {
    return "GenerarEnemigosAccion";
  }

  update(tiempoJuegoMS: number, contexto: ContextoNivel): boolean {
    const caminoSelecionado = this.buscarCaminoParaLosEnemigos(contexto);
    if (!caminoSelecionado) {
      contexto.mostrarMensaje("Error: Los enemigos no tienen camino el cual seguir");
      return true;
    }

    if (!this.tiempoInicial) {
      this.tiempoInicial = tiempoJuegoMS;
    }

    if (this.tiempoInicial + this.inverval <= tiempoJuegoMS) {
      const siguienteTypoEnemigo: TipoEnemigo = this.enemigosAGenerar.shift()!;

      const unidad = contexto.creadorEnemigos.obtener();
      unidad.inicializarEnemigo(siguienteTypoEnemigo);

      unidad.inicializarSeguidorDeObjetivos({
        objetivos: caminoSelecionado.points,
        variacion: 40,
      });

      unidad.generate();

      const enemigos = contexto.creadorEnemigos.obtenerUnidades();
      contexto.creadorTorres.aplicaATodasLasUnidades((torre) => {
        torre.fijarObjetivosDeDisparo(enemigos);
      });
    }

    return this.enemigosAGenerar.length === 0;
  }

  private buscarCaminoParaLosEnemigos(contexto: ContextoNivel): PathDef | undefined {
    return contexto.paths.find((c) => {
      return c.id === this.camino;
    });
  }
}
