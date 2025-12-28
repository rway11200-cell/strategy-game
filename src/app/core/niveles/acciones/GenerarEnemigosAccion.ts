import { ContextoNivel } from "../cargador/ContextoNivel";
import { AccionNivel } from "../cargador/ManejadorEventosNivel";
import { PathDef } from "../cargador/SchemaNivel";

export class GenerarEnemigosAccion implements AccionNivel {
  constructor(
    private cantidad: number,
    private inverval: number,
    private camino: string,
  ) {}

  getNombre(): string {
    return "GenerarEnemigosAccion";
  }

  update(_: number, contexto: ContextoNivel): boolean {
    const caminoSelecionado = this.buscarCaminoParaLosEnemigos(contexto);
    if (!caminoSelecionado) {
      contexto.mostrarMensaje("Error: Los enemigos no tienen camino el cual seguir");
      return true;
    }

    for (let i = 0; i < this.cantidad; i++) {
      // TODO: cambiar metodo de tiempo para que a esto no le afecta el "pausar" el juego
      setTimeout(() => {
        const unidad = contexto.creadorEnemigos.obtener();

        unidad.inicializarSeguidorDeObjetivos({
          objetivos: caminoSelecionado.points,
        });

        unidad.generate();
      }, i * this.inverval);
    }

    const enemigos = contexto.creadorEnemigos.obtenerUnidades();
    contexto.creadorTorres.aplicaATodasLasUnidades((torre) => {
      torre.fijarObjetivosDeDisparo(enemigos);
    });

    return true;
  }

  private buscarCaminoParaLosEnemigos(contexto: ContextoNivel): PathDef | undefined {
    return contexto.paths.find((c) => {
      return c.id === this.camino;
    });
  }
}
