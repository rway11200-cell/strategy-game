import { Ticker } from "pixi.js";
import { waveProgress } from "../../../ui/game/WaveProgress";
import { LevelContext } from "./LevelContext";
import { JsonToLevelConverter } from "./JsonToLevelConverter";

export interface LevelAction {
  getName(): string;
  update(gameTimeMs: number, context: LevelContext): boolean;
}

export class LevelEventManager {
  private index = 0;
  private actions: LevelAction[];
  private waveByActionIndex = new Map<number, number>();

  constructor(levelParser: JsonToLevelConverter) {
    this.actions = levelParser.getActions();
    let wave = 0;
    this.actions.forEach((action, index) => {
      if (action.getName() === "SpawnEnemiesAction") {
        this.waveByActionIndex.set(index, ++wave);
      }
    });
    waveProgress.setTotal(wave);
  }

  update(_time: Ticker, context: LevelContext) {
    const gameTimeMs = _time.lastTime;

    const action = this.actions[this.index];
    if (!action) return;
    const currentWave = this.waveByActionIndex.get(this.index);
    if (currentWave) waveProgress.setCurrent(currentWave);
    const finished = action.update(gameTimeMs, context);
    if (finished) {
      this.index++;
    }
  }
}
