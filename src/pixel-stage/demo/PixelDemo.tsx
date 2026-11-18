"use client";

// Trang thử engine: chọn bài mẫu theo thế giới, chạy bằng <StepPlayer /> toàn cảnh (cùng component dùng ở màn bài học).
import { useState } from "react";
import { SCRIPTS, worldTitle } from "@/pixel-stage";
import type { WorldId } from "@/pixel-stage";
import { exposeStage, StepPlayer } from "@/pixel-stage/react";
import s from "./PixelDemo.module.css";

const WORLD_ORDER: WorldId[] = ["kitchen", "city", "memory", "dungeon", "dj", "blank"];

export function PixelDemo() {
  const [scriptId, setScriptId] = useState(SCRIPTS[0].id);
  const entry = SCRIPTS.find((x) => x.id === scriptId) ?? SCRIPTS[0];

  return (
    <div className={s.root}>
      <StepPlayer
        script={entry.raw}
        devToggles
        onStage={exposeStage}
        title="Pixel Stage"
        toolbar={
          <select id="ps-script" aria-label="Bài mẫu" value={scriptId} onChange={(e) => setScriptId(e.target.value)}>
            {WORLD_ORDER.map((w) => (
              <optgroup key={w} label={worldTitle(w)}>
                {SCRIPTS.filter((x) => x.world === w).map((x) => (
                  <option key={x.id} value={x.id}>{x.title}</option>
                ))}
              </optgroup>
            ))}
          </select>
        }
      />
    </div>
  );
}
