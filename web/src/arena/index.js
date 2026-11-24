// Điểm vào Arena cho trang phòng (index.html là script cổ điển, nên nối qua window.PEArena).
import './arena.css';
import { mount, unmount, status } from './ui.js';

window.PEArena = { mount, unmount, status };
window.dispatchEvent(new Event('pearena:ready'));
