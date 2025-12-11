import { AnimatedSprite, Container, Graphics, ObservablePoint, PointData, Ticker } from "pixi.js";
import { getDistance } from "../../../../engine/utils/maths";
import { debugLogChanged } from "../../../utils/debugLog";
import { herramientaDesarrolloPintarPuntos } from "../../../utils/herramietasDesarrollo";
import { Movimiento } from "../../../utils/movimiento";
import { Proyectil } from "../../../utils/Proyectil";
import { SeguidorDeObjetivos } from "../../../utils/SeguidorDeCaminos";
import { getFrame } from "../../../utils/sprite";
import { CreadorUnidades } from "../CreadorUnidades";

export interface OpcionesDisparo {
  rango: number;
  cadenciaDisparo: number;
  objetivos: Unidad[];
  creadorProyectiles: CreadorUnidades<Proyectil>;
  daño: number;
}

export interface OpcionesSeguidorDeObjetivos {
  objetivos?: PointData[] | Container[];
  variacion?: number;
  velocidad: number;
  forzarActivarSeguidorCamino?: boolean;
}
export interface UnidadProps {
  opcionesSeguidorDeObjetivos?: OpcionesSeguidorDeObjetivos;
  framesJson?: string;
  posicion?: PointData;
  opcionesDisparo?: OpcionesDisparo;
  vida?: number;
}

function esArrayDeUnidades(objetivos: PointData[] | Unidad[]): objetivos is Unidad[] {
  return objetivos.length > 0 && objetivos[0] instanceof Unidad;
}

// Logica comun de una unidad, deberia ser capaz de moverse, atacar, morir, estar quieto, etc
export class Unidad extends Container {
  private contenedorPrincipal: Container;
  private opcionesSeguidorDeObjetivos?: OpcionesSeguidorDeObjetivos;
  public seguidorDeObjetivos?: SeguidorDeObjetivos;

  private opcionesDisparo?: OpcionesDisparo;
  private tiempoUltimoDisparo: number = 0;
  public objetivoADisparar?: Unidad;

  private rangoGraph?: Graphics;

  private movimiento: Movimiento;

  public animateSrinte: AnimatedSprite;

  private vida: number = 1000;
  private vidaActual: number = this.vida;
  private graficaVida: Graphics;
  public activo: boolean = false;
  public onDestruye?: (unidad: Unidad) => void;

  constructor(contenedorPrincipal: Container, opciones?: UnidadProps) {
    super();

    this.contenedorPrincipal = contenedorPrincipal;
    this.contenedorPrincipal.addChild(this);

    if (!opciones) {
      throw new Error("No puedes crear una unidad sin opciones");
    }

    const { framesJson, opcionesDisparo, opcionesSeguidorDeObjetivos, posicion, vida } = opciones;

    this.opcionesDisparo = opcionesDisparo;
    this.opcionesSeguidorDeObjetivos = opcionesSeguidorDeObjetivos;

    if (posicion) {
      this.position = posicion;
    }

    const velocidad = this.opcionesSeguidorDeObjetivos?.velocidad ?? 1;
    this.movimiento = new Movimiento(velocidad);

    if (!framesJson) {
      throw new Error(`framesJson viene vacio.`);
    }

    this.animateSrinte = new AnimatedSprite(getFrame(framesJson));
    this.animateSrinte.animationSpeed = 10 / 60;
    this.animateSrinte.anchor.set(0.5);
    this.animateSrinte.visible = false;
    this.addChild(this.animateSrinte);

    this.graficaVida = new Graphics();
    if (vida) {
      this.vida = vida;
      this.vidaActual = vida;
      const altoVida = 2;
      const ajusteAlto = 20;
      const anchoVida = 30;

      this.graficaVida
        .rect(0, -this.animateSrinte.height / 2 + ajusteAlto, anchoVida, altoVida)
        .fill("green");
      this.graficaVida.position.x = -(anchoVida / 2);
      this.graficaVida.visible = false;
      this.addChild(this.graficaVida);
    }

    this.inicializarSeguidorDeObjetivos();
    this.inicializarRangoDisparo();
  }

  private inicializarRangoDisparo() {
    if (this.opcionesDisparo?.rango) {
      this.rangoGraph = herramientaDesarrolloPintarPuntos(
        this,
        { x: 0, y: 0 },
        "yellow",
        this.opcionesDisparo.rango,
        "circulo",
      );
      this.rangoGraph.visible = false;
    }
  }

  private inicializarSeguidorDeObjetivos() {
    const objetivos = this.opcionesSeguidorDeObjetivos?.objetivos;
    if (objetivos && objetivos.length > 0) {
      this.seguidorDeObjetivos = new SeguidorDeObjetivos();

      if (esArrayDeUnidades(objetivos)) {
        this.seguidorDeObjetivos.setRutaDesdeUnidades({
          unidades: objetivos,
          loop: false,
        });
      } else {
        this.seguidorDeObjetivos.setRutaDesdePuntos({
          puntos: objetivos,
          variacion: this.seguidorDeObjetivos?.variacion || 0,
          loop: false,
        });
      }

      const objetivo = this.seguidorDeObjetivos.objetivo;
      if (objetivo) {
        this.position = objetivo;
      }
    } else if (this.opcionesSeguidorDeObjetivos?.forzarActivarSeguidorCamino) {
      this.seguidorDeObjetivos = new SeguidorDeObjetivos();
    }
  }

  public update(_time: Ticker) {
    if (!this.activo || !this.animateSrinte.visible) return;

    this.actualizarMovimiento(_time);
    this.actulizarVida(_time);
    this.actualizarDisparo(_time);
  }
  private actulizarVida(_time: Ticker) {
    if (!this.vida) return;

    const porcentajeVidaActual = (this.vidaActual * 100) / this.vida;
    this.graficaVida.visible = porcentajeVidaActual < 100;
    this.graficaVida.scale.x = porcentajeVidaActual / 100;
  }

  private actualizarMovimiento(_time: Ticker) {
    if (!this.seguidorDeObjetivos) return;

    const objetivo = this.seguidorDeObjetivos.objetivo;
    if (!objetivo) return;

    const llegoAlObjetivoActual = this.movimiento.caminar(this, objetivo, _time, 0.5);
    if (llegoAlObjetivoActual) {
      this.seguidorDeObjetivos.avanzarAlSiguienteObjetivo();
    }
  }

  private actualizarDisparo(_time: Ticker) {
    const opcionesDisparo = this.opcionesDisparo;
    if (!opcionesDisparo?.rango) return;

    if (opcionesDisparo.objetivos && opcionesDisparo.objetivos.length > 0) {
      const objetivo = obtenerObjetivoCercano(
        this.position,
        opcionesDisparo.objetivos,
        opcionesDisparo.rango,
      );
      this.objetivoADisparar = objetivo;

      debugLogChanged(
        this.getID("objetivo"),
        this.objetivoADisparar ? this.objetivoADisparar.uid : null,
        { prefix: "[TARGET]", enabled: false },
      );
    } else {
      debugLogChanged(this.getID("con-rango-pero-sin-objetivos"), this, {
        prefix: "[DEBUG]",
        enabled: false,
      });
    }

    if (!this.objetivoADisparar) return;

    const tiempoDesdeUltimoDisparo = _time.lastTime - this.tiempoUltimoDisparo;
    const cadenciaDisparoEnMiliSegundos = opcionesDisparo.cadenciaDisparo * 1000;

    if (tiempoDesdeUltimoDisparo < cadenciaDisparoEnMiliSegundos) return;

    this.tiempoUltimoDisparo = _time.lastTime;

    const nuevoProyectil = opcionesDisparo.creadorProyectiles.obtener();
    if (!nuevoProyectil.seguidorDeObjetivos) return;

    nuevoProyectil.seguidorDeObjetivos.setRutaDesdeUnidades({
      unidades: [this, this.objetivoADisparar],
    });
    nuevoProyectil.seguidorDeObjetivos.onDestino = () => {
      nuevoProyectil.destruye();
      this.objetivoADisparar?.dañar(this.opcionesDisparo?.daño);
      if (this.objetivoADisparar?.estaMuerto()) {
        this.objetivoADisparar = undefined;
      }
    };
    nuevoProyectil.generate();
  }

  public estaMuerto(): boolean {
    return !this.activo;
  }

  public generate() {
    this.visible = true;
    this.activo = true;

    this.animateSrinte.visible = true;
    this.animateSrinte.play();

    if (this.seguidorDeObjetivos) {
      this.seguidorDeObjetivos.reset();
      this.position = this.seguidorDeObjetivos.obtenerOrigen();
    }

    if (this.rangoGraph) {
      this.rangoGraph.visible = true;
    }

    if (this.vida) {
      this.vidaActual = this.vida;
    }
  }

  public destruye() {
    this.visible = false;
    this.activo = false;

    this.animateSrinte.visible = false;
    this.animateSrinte.stop();

    this.onDestruye?.(this);
  }

  public dañar(daño?: number) {
    if (!daño) {
      return;
    }

    this.vidaActual = this.vidaActual - daño;
    if (this.vidaActual <= 0) {
      this.destruye();
    }
  }

  public getID(complemento?: string): string {
    return `${this.constructor.name.toString()}-${this.uid}-${complemento}`;
  }
}

function obtenerObjetivoCercano(
  position: ObservablePoint,
  objetivos: Unidad[],
  rango: number,
): Unidad | undefined {
  let objetivoCercano: Unidad | undefined;
  let distanciaObjetivoCercano = 1000000000000;

  objetivos.forEach((objetivo) => {
    if (objetivo.activo) {
      const distanciaActual = getDistance(position.x, position.y, objetivo.x, objetivo.y);
      if (distanciaActual < distanciaObjetivoCercano && distanciaActual <= rango) {
        distanciaObjetivoCercano = distanciaActual;
        objetivoCercano = objetivo;
      }
    }
  });
  return objetivoCercano;
}
