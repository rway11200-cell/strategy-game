import { Color, PointData, Sprite, Texture } from "pixi.js";

interface opcionesProyectil {
  origen: PointData;
}

export class Proyectil {
  public sprite: Sprite;
  private origen: PointData;
  constructor(opciones: opcionesProyectil) {
    const { origen } = opciones;

    this.origen = origen;
    this.sprite = new Sprite({
      texture: Texture.WHITE,
      position: this.origen,
      tint: new Color("yellow"),
      width: 20,
      height: 20,
    });
  }

  public destruye() {
    this.sprite.visible = false;
    this.sprite.position = this.origen;
  }
}
