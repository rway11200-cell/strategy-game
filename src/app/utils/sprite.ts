import { AnimatedSpriteFrames, Assets, Spritesheet, Texture } from "pixi.js";

interface AsepriteFrame {
  filename: string;
  duration?: number;
}
interface AsepriteJSON {
  frames: AsepriteFrame[] | Record<string, { duration?: number }>;
}

const cache: Record<
  string,
  { textures: AnimatedSpriteFrames; totalMs: number; frameMs: number[] }
> = {};

/**
 * Obtiene texturas ordenadas desde un spritesheet Aseprite o Pixi,
 * soportando ambos formatos de `sheet.data.frames` (array u objeto).
 */
export function getFramesAseprite(
  assetId: string,
  patronNombreFrames: RegExp = /(\d+)\.(png|aseprite)$/,
) {
  const cached = cache[assetId];
  if (cached) return cached;

  // Tipamos sheet.data como AsepriteJSON para poder leer frames
  const sheet = Assets.get<Spritesheet & { data: AsepriteJSON }>(assetId);
  if (!sheet) throw new Error(`Spritesheet "${assetId}" no encontrado.`);

  const raw = sheet.data.frames;

  // Normalizar a array de AsepriteFrame[]
  let rawFramesArray: AsepriteFrame[] = [];

  if (Array.isArray(raw)) {
    // caso ideal: ya es array (export directo de Aseprite)
    rawFramesArray = raw as AsepriteFrame[];
  } else if (raw && typeof raw === "object") {
    // caso Pixi: frames es un objeto con keys -> convertir a array
    rawFramesArray = Object.keys(raw).map((name) => {
      const entry = (raw as Record<string, any>)[name];
      return {
        filename: name,
        duration: entry?.duration ?? 0,
      } as AsepriteFrame;
    });
  } else {
    throw new Error("Formato de sheet.data.frames no soportado.");
  }

  // ahora sí podemos mapear, extraer id, ordenar...
  const parsed = rawFramesArray
    .map((f, index) => {
      const match = f.filename.match(patronNombreFrames);
      const id = match ? Number(match[1]) : -1;
      return { name: f.filename, index, id, duration: f.duration ?? 0 };
    })
    .filter((f) => f.id !== -1)
    .sort((a, b) => a.id - b.id);

  const textures = parsed
    .map((p) => sheet.textures[String(p.index)] ?? sheet.textures[p.name])
    .filter((t): t is Texture => t !== undefined);

  const frameMs = parsed.map((f) => f.duration);
  const totalMs = frameMs.reduce((s, v) => s + v, 0);

  const result = { textures, totalMs, frameMs, assetId };
  cache[assetId] = result;
  return result;
}
