import { Container, PointData } from "pixi.js";
import { randomFloat } from "../../engine/utils/random";

interface SeguidorDeObjetuvosDesdePuntosProp {
  puntos: PointData[];
  variacion: number;
  loop?: boolean;
}

interface SeguidorDeObjetuvosDesdeContainerProp {
  containers: Container[];
  loop?: boolean;
}

type ObjetivoProvider = () => PointData;

// Componente que busca el siguiente camino a seguir
export class SeguidorDeObjetivos {
  private objetivos: ObjetivoProvider[] = [];
  private i = 0;
  private loop = false;
  public variacion: number = 0;
  public onDestino?: () => void;

  constructor() {}

  setRutaDesdePuntos({ puntos, variacion = 0, loop = false }: SeguidorDeObjetuvosDesdePuntosProp) {
    this.variacion = variacion;
    this.objetivos = puntos.map((punto): ObjetivoProvider => {
      const puntoConVariacion: PointData = {
        x: punto.x + randomFloat(-variacion, variacion),
        y: punto.y + randomFloat(-variacion, variacion),
      };

      return () => puntoConVariacion;
    });
    this.i = 0;
    this.loop = loop;
  }

  setRutaDesdeContainer({ containers, loop = false }: SeguidorDeObjetuvosDesdeContainerProp) {
    this.objetivos = containers.map((container): ObjetivoProvider => {
      return () => {
        return {
          x: container.position.x,
          y: container.position.y,
        };
      };
    });
    this.i = 0;
    this.loop = loop;
  }

  get objetivo(): PointData | undefined {
    const result = this.objetivos[this.i];
    if (!result) return;
    return result();
  }

  avanzarAlSiguienteObjetivo() {
    if (!this.objetivos.length) return;
    this.i++;
    if (this.i >= this.objetivos.length) {
      this.i = this.loop ? 0 : this.objetivos.length - 1;
      this.onDestino?.();
    }
  }

  get terminado(): boolean {
    return !this.loop && this.objetivos.length > 0 && this.i === this.objetivos.length - 1;
  }

  reset() {
    this.i = 0;
  }

  obtenerOrigen(): PointData {
    const origen = this.objetivo;
    if (!origen) {
      console.warn("SeguidorDeObjetivos.obtenerOrigen: no hay objetivos definidos");
      return { x: 0, y: 0 };
    }
    return origen;
  }
}
