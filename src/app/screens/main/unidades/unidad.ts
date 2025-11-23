import { AnimatedSprite, Container, PointData, Ticker } from "pixi.js";
import { Movimiento } from "../../../utils/movimiento";
import { SeguidorDeCaminos } from "../../../utils/SeguidorDeCaminos";
import { getFrame } from "../../../utils/sprite";

export interface UnidadProps {
  camino?: PointData[];
  framesJson?: string;
}

// Logica comun de una unidad, deberia ser capaz de moverse, atacar, morir, estar quieto, etc
export class Unidad extends Container {
  public animateSrinte: AnimatedSprite;
  private seguidorDeCaminos?: SeguidorDeCaminos;
  private movimiento: Movimiento;
  velocidad: number = 1;
  vida: number = 1000;
  constructor(opciones?: UnidadProps) {
    super();

    if (!opciones) {
      throw new Error(`Como vas a crear una undiad sin animacion ni camino,`);
    }
    const { camino, framesJson } = opciones;

    this.movimiento = new Movimiento(this.velocidad);

    if (!framesJson) {
      throw new Error(`framesJson viene vacio.`);
    }

    this.animateSrinte = new AnimatedSprite(getFrame(framesJson));
    this.animateSrinte.animationSpeed = 10 / 60;
    this.animateSrinte.anchor.set(0.5);
    this.animateSrinte.visible = false;
    this.addChild(this.animateSrinte);
    if (camino && camino.length > 0) {
      this.seguidorDeCaminos = new SeguidorDeCaminos({
        puntos: camino,
        variacion: 10,
      });

      const objetivo = this.seguidorDeCaminos.objetivo;
      if (objetivo) {
        this.position = objetivo;
      }
    }
  }
  seguirRuta(puntos: PointData[], loop = false) {
    if (!this.seguidorDeCaminos) {
      throw new Error("No puedes seguir una ruta si no exite ni la ruta");
    }

    this.seguidorDeCaminos.setRuta(puntos, loop);
  }

  caminarA(target: PointData) {
    if (!this.seguidorDeCaminos) {
      throw new Error("No puedes caminar a un punto si no exite ni la ruta");
    }

    this.seguidorDeCaminos.setRuta([target], false);
  }

  public update(_time: Ticker) {
    if (!this.animateSrinte.visible) return;

    if (this.seguidorDeCaminos) {
      this;
      const objetivo = this.seguidorDeCaminos.objetivo;
      if (!objetivo) return;

      const llegoAlObjetivoActual = this.movimiento.caminar(this, objetivo, _time, 0.5);
      if (llegoAlObjetivoActual) {
        this.seguidorDeCaminos.avanzarAlSiguienteObjetivo();
      }
    }
  }

  public generate() {
    if (this.seguidorDeCaminos) {
      this.seguidorDeCaminos.reset();
      this.position = this.seguidorDeCaminos.obtenerOrigen();
    }

    this.animateSrinte.visible = true;
    this.animateSrinte.play();
  }

  public destruye() {
    this.animateSrinte.visible = false;
    this.animateSrinte.stop();

    setTimeout(() => {
      this.generate();
    }, 5000);
  }
}
