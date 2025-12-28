import { Container } from "pixi.js";
import { Label } from "../Label";

export class NotificacionesUI {
  private labels: Label[];
  private mainContainer: Container;
  private centerX: number;
  private centerY: number;
  constructor(mainContainer: Container) {
    this.labels = [];
    this.mainContainer = mainContainer;
    this.centerX = 0;
    this.centerY = 0;
  }

  resize(centerX: number, centerY: number) {
    this.centerX = centerX;
    this.centerY = centerY;

    this.labels.forEach((label, index) => {
      label.x = this.centerX - 50;
      label.y = -this.centerY + 150 + index * 50;
    });
  }

  notifica(mensaje: string) {
    const labelEncontrado = this.labels.find((label) => {
      return label.text === "";
    });

    if (labelEncontrado) {
      labelEncontrado.text = mensaje;
      this.limpiarLabel(labelEncontrado);
      return;
    }

    const labelNuevo = new Label({
      text: mensaje,
      style: {
        fill: "white",
        align: "right",
      },
    });
    labelNuevo.anchor.set(1, 0.5);

    this.labels.push(labelNuevo);
    this.mainContainer.addChild(labelNuevo);
    this.resize(this.centerX, this.centerY);

    this.limpiarLabel(labelNuevo);
  }

  private limpiarLabel(labe: Label) {
    setTimeout(() => {
      labe.text = "";
    }, 3000);
  }
}
