/* Mở cửa sổ thì đèn dây nhấp nháy nhanh hơn (playbackRate 1,7 trên animation CSS twk). */
import { useEffect, type RefObject } from "react";

export function useBulbTempo(appRef: RefObject<HTMLElement | null>, windowOpen: boolean) {
  useEffect(() => {
    appRef.current?.querySelectorAll(".bulb i").forEach((b) => b.getAnimations().forEach((a) => (a.playbackRate = windowOpen ? 1.7 : 1)));
  }, [appRef, windowOpen]);
}
