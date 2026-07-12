import { Container, Graphics } from "pixi.js";
import { Label } from "../Label";

export class CoinsUI extends Container {
  public numberLabel: Label;
  private lastValue = 0;
  constructor() {
    super();
    const background = new Graphics();
    const panelWidth = 200;
    const panelHeight = 40;
    background.roundRect(0, 0, panelWidth, panelHeight, 4).fill({ color: 0xffffff, alpha: 0.4 });

    this.addChild(background);

    this.numberLabel = new Label({
      text: "$0",
      style: {
        fill: "yellow",
        align: "right",
      },
    });
    this.numberLabel.anchor.set(1, 0.5);
    this.numberLabel.x = panelWidth - 10;
    this.numberLabel.y = panelHeight / 2;

    this.addChild(this.numberLabel);
  }

  public setCoins(value: number): void {
    if (this.lastValue === value) return;

    this.numberLabel.text = `$${value}`;
    this.lastValue = value;
  }
}
