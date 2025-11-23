import { PointData } from "pixi.js";
import { randomFloat } from "../../engine/utils/random";

interface SeguidorDeCaminosProp {
  puntos: PointData[];
  variacion: number;
  loop?: boolean;
}

// Componente que busca el siguiente camino a seguir
export class SeguidorDeCaminos {
  private puntos: PointData[] = [];
  private i = 0;
  private loop = false;
  private variacion: number;

  constructor({ puntos, variacion, loop }: SeguidorDeCaminosProp) {
    this.variacion = variacion;
    this.setRuta(puntos, loop);
  }

  setRuta(puntos: PointData[], bucle = false) {
    // Aplica variacion en los puntos
    this.puntos = puntos.map((punto): PointData => {
      return {
        x: punto.x + randomFloat(-this.variacion, this.variacion),
        y: punto.y + randomFloat(-this.variacion, this.variacion),
      };
    });

    this.i = 0;
    this.loop = bucle;
  }

  get objetivo(): PointData | undefined {
    const objetivo = this.puntos[this.i];
    return objetivo;
  }

  avanzarAlSiguienteObjetivo() {
    if (!this.puntos.length) return;
    this.i++;
    if (this.i >= this.puntos.length) {
      this.i = this.loop ? 0 : this.puntos.length - 1;
    }
  }

  get terminado(): boolean {
    return !this.loop && this.puntos.length > 0 && this.i === this.puntos.length - 1;
  }

  reset() {
    this.i = 0;
  }

  obtenerOrigen(): PointData {
    return this.puntos[0];
  }
}
