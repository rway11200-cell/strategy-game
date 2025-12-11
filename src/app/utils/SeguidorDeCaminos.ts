import { PointData } from "pixi.js";
import { randomFloat } from "../../engine/utils/random";
import { Unidad } from "../screens/main/unidades/unidad";

interface SeguidorDeObjetuvosDesdePuntosProp {
  puntos: PointData[];
  variacion: number;
  loop?: boolean;
}

interface SeguidorDeObjetuvosDesdeContainerProp {
  unidades: Unidad[];
  loop?: boolean;
}

type ObjetivoProvider = () => PointData;

// Componente que busca el siguiente camino a seguir
export class SeguidorDeObjetivos {
  private objetivos: ObjetivoProvider[] = [];
  private unidades?: Unidad[];
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

  setRutaDesdeUnidades({ unidades, loop = false }: SeguidorDeObjetuvosDesdeContainerProp) {
    if (!unidades) {
      throw new Error("setRutaDesdeUnidades con unidades vacias");
    }

    this.unidades = unidades;
    this.objetivos = unidades.map((unidad): ObjetivoProvider => {
      return () => {
        return {
          x: unidad.position.x,
          y: unidad.position.y,
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

  public obtenerOrigen(): PointData {
    if (!this.objetivos || this.objetivos.length === 0) {
      console.warn("SeguidorDeObjetivos.obtenerOrigen: no hay objetivos definidos");
      return { x: 0, y: 0 };
    }
    const result = this.objetivos[0];
    return result();
  }

  public obtenerFinal(): PointData {
    if (!this.objetivos || this.objetivos.length === 0) {
      console.warn("SeguidorDeObjetivos.obtenerFinal: no hay objetivos definidos");
      return { x: 0, y: 0 };
    }
    const result = this.objetivos[this.objetivos.length - 1];
    return result();
  }

  public obtenerUnidadFinal(): Unidad | undefined {
    if (!this.unidades || this.unidades.length === 0) {
      console.warn("SeguidorDeObjetivos.obtenerUnidadFinal: no hay unidades definidos");
      return;
    }
    return this.unidades[this.unidades.length - 1];
  }
}
