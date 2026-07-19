import { Container, Graphics } from "pixi.js";
import { Label } from "../Label";
import { WaveUI } from "./WaveUI";

export class CoinsUI extends Container {
  public numberLabel: Label;
  public waveUI: WaveUI;
  private lastValue = 0;
  constructor() {
    super();
    const background = new Graphics();
    const panelWidth = 200;
    const panelHeight = 72;
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
    this.numberLabel.y = 20;

    this.addChild(this.numberLabel);

    this.waveUI = new WaveUI();
    this.waveUI.x = panelWidth / 2;
    this.waveUI.y = 51;
    this.addChild(this.waveUI);
  }

  public setCoins(value: number): void {
    if (this.lastValue === value) return;

    this.numberLabel.text = `$${value}`;
    this.lastValue = value;
  }
}
