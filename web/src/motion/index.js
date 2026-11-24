// ============================================================================
// ENTRYPOINT · PE MOTION GRAPHIC LESSON ENGINE (11 CHẶNG M1–M11)
// Nối vào index.html của PE-3d/web qua window.PEMotion
// ============================================================================

import './motion.css';
import { STAGE, base, accents, WORLDS, motion, createRng } from './tokens.js';
import { LESSONS_11, getDeterministicSnapshot } from './scenarios.js';
import { createLessonController } from './ui.js';

let activeController = null;

export function mount(containerEl, opts = {}) {
  if (!containerEl) return null;
  if (activeController) {
    activeController.destroy();
    activeController = null;
  }
  activeController = createLessonController(containerEl, opts);
  return activeController;
}

export function unmount() {
  if (activeController) {
    activeController.destroy();
    activeController = null;
  }
}

export {
  STAGE,
  base,
  accents,
  WORLDS,
  motion,
  createRng,
  LESSONS_11,
  getDeterministicSnapshot,
  createLessonController,
};

if (typeof window !== 'undefined') {
  window.PEMotion = {
    mount,
    unmount,
    LESSONS_11,
    getDeterministicSnapshot,
    STAGE,
    base,
    accents,
    WORLDS,
    motion,
  };
  window.dispatchEvent(new Event('pemotion:ready'));
}
