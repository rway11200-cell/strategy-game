import { Container } from "pixi.js";
import { debugLogChanged } from "../../utils/debugLog";
import { FramesJson, Unidad } from "./Unidad";

export enum TipoEnemigo {
  Globlin = "globlin",
  Esqueleto = "esqueleto",
  Fantasma = "fantasma",
}

type DefinicionEnemigo = {
  vida: number;
  velocidad: number;
  framesJson: FramesJson;
  recompensa: number;
};

const DefinicionDeEnemigos = new Map<TipoEnemigo, DefinicionEnemigo>([
  [
    TipoEnemigo.Esqueleto,
    {
      vida: 600,
      velocidad: 0.5,
      recompensa: 50,
      framesJson: {
        idle: "esqueleton-idle.json",
        run: "esqueleton-run.json",
        dead: "esqueleton-dead.json",
      },
    },
  ],
  [
    TipoEnemigo.Fantasma,
    {
      vida: 70,
      velocidad: 1.2,
      recompensa: 15,
      framesJson: {
        idle: "fantasma-idle.json",
        run: "fantasma-run.json",
        dead: "fantasma-dead.json",
      },
    },
  ],
  [
    TipoEnemigo.Globlin,
    {
      vida: 50,
      velocidad: 0.6,
      recompensa: 6,
      framesJson: {
        idle: "goblin scout - silhouette all animations-idle.json",
        run: "goblin scout - silhouette all animations-run.json",
        dead: "goblin scout - silhouette all animations-death 1.json",
      },
    },
  ],
]);

export class Enemigo extends Unidad {
  private recompensa: number = 10;
  constructor(contenedorPrincipal: Container) {
    super(contenedorPrincipal);
  }

  inicializarEnemigo(sigueinteTypoEnemigo: TipoEnemigo) {
    const defEnemigo = DefinicionDeEnemigos.get(sigueinteTypoEnemigo);
    if (!defEnemigo) {
      debugLogChanged(this.getID("No se encontro la DefinicionDeEnemigos"));
      return;
    }

    this.inicializarAnimacion(defEnemigo.framesJson);
    this.inicializarBarraVida(defEnemigo.vida);
    this.inicializarVelocidad(defEnemigo.velocidad);
    this.recompensa = defEnemigo.recompensa;
  }

  public getRecompensaAlMorir(): number {
    return this.recompensa;
  }
}
