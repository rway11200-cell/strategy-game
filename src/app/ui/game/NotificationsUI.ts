import { Container } from "pixi.js";
import { Label } from "../Label";

export class NotificationsUI {
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

  notify(message: string) {
    const foundLabel = this.labels.find((label) => {
      return label.text === "";
    });

    if (foundLabel) {
      foundLabel.text = message;
      this.clearLabel(foundLabel);
      return;
    }

    const newLabel = new Label({
      text: message,
      style: {
        fill: "white",
        align: "right",
      },
    });
    newLabel.anchor.set(1, 0.5);

    this.labels.push(newLabel);
    this.mainContainer.addChild(newLabel);
    this.resize(this.centerX, this.centerY);

    this.clearLabel(newLabel);
  }

  private clearLabel(label: Label) {
    setTimeout(() => {
      label.text = "";
    }, 3000);
  }
}
