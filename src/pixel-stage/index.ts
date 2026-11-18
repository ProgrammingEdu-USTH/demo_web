// API công khai của engine. Thuần TypeScript, không phụ thuộc React.
export { createPixelStage } from "./core/stage";
export { pixelate } from "./core/transition";
export type { PixelStage, StageOptions, StageState } from "./core/stage";
export type { StepEvent } from "./timeline/player";
export type { Action, Step, StepScript, WorldId } from "./timeline/types";
export { parseScript } from "./timeline/validate";
export { SCRIPTS } from "./worlds/scripts";
export { worldTitle } from "./worlds";
export type { ScriptEntry } from "./worlds/scripts";
export { fromAseprite } from "./assets/sheet";
export type { SpriteSheet, AsepriteJson } from "./assets/sheet";
