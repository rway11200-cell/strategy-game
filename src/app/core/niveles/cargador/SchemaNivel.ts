export type LevelJSON = {
  id: string;
  version: number;

  meta?: {
    name?: string;
    description?: string;
  };

  initialState: {
    coins: number;
    lives?: number;
  };

  background?: BackgroundDef;
  paths?: PathDef[];

  entities?: EntityDef[];
  timeline: LevelEvent[];
};

export type BackgroundDef = {
  texture: string;
  parallax?: number;
};

export type PathDef = {
  id: string;
  points: { x: number; y: number }[];
};

export type EntityDef = {
  id: string;
  type: string;
  x: number;
  y: number;
  props?: Record<string, any>;
};

export type LevelEvent =
  | { type: "wait"; seconds: number }
  | { type: "spawn"; enemy: string; count: number; interval?: number; path?: string }
  | { type: "waitUntilClear" }
  | { type: "parallel"; events: LevelEvent[] }
  | { type: "notification"; text: string }
  | { type: "spawn_entities" };
