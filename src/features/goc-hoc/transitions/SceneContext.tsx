/* SceneController dùng chung: trang hiện tại, opts, busy, peeking, camera và các lệnh go/back/sibling.
   GocHocApp tạo controller (useSceneController) và cung cấp qua context; trang con đọc bằng useScene(). */
"use client";
import { createContext, useContext } from "react";
import type { SceneApi } from "./useSceneController";

export const SceneContext = createContext<SceneApi | null>(null);

export function useScene(): SceneApi {
  const s = useContext(SceneContext);
  if (!s) throw new Error("useScene() phải nằm trong <SceneContext.Provider> (GocHocApp)");
  return s;
}
