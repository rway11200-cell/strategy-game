import { Container } from "pixi.js";
import { Label } from "../Label";
import { waveProgress } from "./WaveProgress";

export class WaveUI extends Container {
  public readonly waveLabel: Label;

  constructor() {
    super();

    this.waveLabel = new Label({
      text: "Wave 0/0",
      style: {
        fill: "white",
        fontSize: 18,
        fontWeight: "bold",
      },
    });
    this.addChild(this.waveLabel);

    waveProgress.subscribe(({ current, total }) => {
      this.waveLabel.text = `Wave ${current}/${total}`;
    });
  }
}
