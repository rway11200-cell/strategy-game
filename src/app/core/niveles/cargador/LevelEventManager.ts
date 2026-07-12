import { Ticker } from "pixi.js";
import { LevelContext } from "./LevelContext";
import { JsonToLevelConverter } from "./JsonToLevelConverter";

export interface LevelAction {
  getName(): string;
  update(gameTimeMs: number, context: LevelContext): boolean;
}

export class LevelEventManager {
  private index = 0;
  private actions: LevelAction[];

  constructor(levelParser: JsonToLevelConverter) {
    this.actions = levelParser.getActions();
  }

  update(_time: Ticker, context: LevelContext) {
    const gameTimeMs = _time.lastTime;

    const action = this.actions[this.index];
    if (!action) return;
    const finished = action.update(gameTimeMs, context);
    if (finished) {
      this.index++;
    }
  }
}
