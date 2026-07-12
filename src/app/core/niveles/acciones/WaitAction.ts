import { LevelContext } from "../cargador/LevelContext";
import { LevelAction } from "../cargador/LevelEventManager";

export class WaitAction implements LevelAction {
  private initialTime?: number;
  private secondsToWait: number;
  constructor(secondsToWait: number) {
    this.secondsToWait = secondsToWait;
  }
  getName(): string {
    return "WaitAction";
  }
  update(gameTimeMs: number, _: LevelContext): boolean {
    if (!this.initialTime) {
      this.initialTime = gameTimeMs;
      return false;
    }

    const millisecondsToWait = this.secondsToWait * 1000;
    if (gameTimeMs - this.initialTime < millisecondsToWait) {
      return false;
    }

    return true;
  }
}
