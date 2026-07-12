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
 * Gets ordered textures from an Aseprite or Pixi spritesheet,
 * supporting both array and object formats of `sheet.data.frames`.
 */
export function getFramesAseprite(
  assetId: string,
  frameNamePattern: RegExp = /(\d+)\.(png|aseprite)$/,
) {
  const cached = cache[assetId];
  if (cached) return cached;

  const sheet = Assets.get<Spritesheet & { data: AsepriteJSON }>(assetId);
  if (!sheet) throw new Error(`Spritesheet "${assetId}" not found.`);

  const raw = sheet.data.frames;

  let rawFramesArray: AsepriteFrame[] = [];

  if (Array.isArray(raw)) {
    // ideal case: already an array (direct Aseprite export)
    rawFramesArray = raw as AsepriteFrame[];
  } else if (raw && typeof raw === "object") {
    // Pixi case: frames is an object with keys -> convert to array
    rawFramesArray = Object.keys(raw).map((name) => {
      const entry = (raw as Record<string, any>)[name];
      return {
        filename: name,
        duration: entry?.duration ?? 100,
      } as AsepriteFrame;
    });
  } else {
    throw new Error("sheet.data.frames format not supported.");
  }

  const parsed = rawFramesArray
    .map((f, index) => {
      const match = f.filename.match(frameNamePattern);
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
