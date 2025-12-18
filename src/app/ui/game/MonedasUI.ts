import { Container, Graphics } from "pixi.js";
import { Label } from "../Label";

export class MonedasUI extends Container {
  public numeroLabel: Label;
  private ultimoValor = 0;
  constructor() {
    super();
    const backGround = new Graphics();
    const panelWidth = 200;
    const panelHeight = 40;
    backGround.roundRect(0, 0, panelWidth, panelHeight, 4).fill({ color: 0xffffff, alpha: 0.4 });

    this.addChild(backGround);

    this.numeroLabel = new Label({
      text: "$0",
      style: {
        fill: "yellow",
        align: "right",
      },
    });
    this.numeroLabel.anchor.set(1, 0.5);
    this.numeroLabel.x = panelWidth - 10;
    this.numeroLabel.y = panelHeight / 2;

    this.addChild(this.numeroLabel);
  }

  public asignarMonedas(valor: number): void {
    if (this.ultimoValor === valor) return;

    this.numeroLabel.text = `$${valor}`;
    this.ultimoValor = valor;
  }
}
