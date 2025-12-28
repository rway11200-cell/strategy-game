import { LevelJSON } from "./SchemaNivel";

export class CargadorJsonNivel {
  constructor() {}

  async load(pathJson: string): Promise<LevelJSON> {
    const response = await fetch(pathJson);

    if (!response.ok) {
      throw new Error(`No se pudo cargar el nivel: ${pathJson}`);
    }

    const data = await response.json();

    return data as LevelJSON;
  }
}
