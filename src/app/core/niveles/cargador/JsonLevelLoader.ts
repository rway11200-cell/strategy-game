import { LevelJSON } from "./LevelSchema";

export class JsonLevelLoader {
  constructor() {}

  async load(jsonPath: string): Promise<LevelJSON> {
    const response = await fetch(jsonPath);

    if (!response.ok) {
      throw new Error(`Could not load level: ${jsonPath}`);
    }

    const data = await response.json();

    return data as LevelJSON;
  }
}
