'use client';
import { useSyncExternalStore } from 'react';
import { KEY } from './look-script';

// Per-device display choices. They are stored in localStorage and applied as data-* attributes on <html>.
export type Look = { palette: string; board: string; pieces: string; font: string };
export const defaultLook: Look = { palette: 'forest', board: 'green', pieces: 'rhos', font: 'fresh' };
export const palettes = [
 { id: 'forest', label: 'Forest', swatch: '#5d8a2f' }, { id: 'ocean', label: 'Ocean', swatch: '#1f7aa8' },
 { id: 'indigo', label: 'Indigo', swatch: '#3b5bdb' }, { id: 'royal', label: 'Royal', swatch: '#6d4fd6' },
 { id: 'rose', label: 'Rose', swatch: '#d1456f' }, { id: 'sunset', label: 'Sunset', swatch: '#d9622b' },
 { id: 'mint', label: 'Mint', swatch: '#0f9a8a' }, { id: 'graphite', label: 'Graphite', swatch: '#d9a21b' },
];
export const boards = [
 { id: 'green', label: 'Green', light: '#eeeed2', dark: '#769656' }, { id: 'brown', label: 'Classic', light: '#f0d9b5', dark: '#b58863' },
 { id: 'blue', label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' }, { id: 'purple', label: 'Purple', light: '#efefef', dark: '#8476ba' },
 { id: 'slate', label: 'Slate', light: '#d9dde3', dark: '#6f7f95' }, { id: 'coral', label: 'Coral', light: '#f8e3d2', dark: '#cf8f6b' },
 { id: 'night', label: 'Night', light: '#7b8590', dark: '#3e4a58' },
];
export const pieceSets = [{ id: 'rhos', label: 'Modern' }, { id: 'classic', label: 'Chessito classic' }];
export const fonts = [{ id: 'fresh', label: 'Fresh', sample: 'Plus Jakarta Sans + Sora' }, { id: 'clean', label: 'Clean', sample: 'Inter' }, { id: 'soft', label: 'Soft', sample: 'Nunito' }];

let current: Look = defaultLook; let loaded = false; const subs = new Set<() => void>();
const valid = (l: Partial<Look>): Look => ({
 palette: palettes.some(p => p.id === l.palette) ? l.palette! : defaultLook.palette,
 board: boards.some(b => b.id === l.board) ? l.board! : defaultLook.board,
 pieces: pieceSets.some(p => p.id === l.pieces) ? l.pieces! : defaultLook.pieces,
 font: fonts.some(f => f.id === l.font) ? l.font! : defaultLook.font,
});
function load() {
 if (loaded || typeof window === 'undefined') return; loaded = true;
 try { current = valid(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { current = defaultLook; }
}
export function applyLook(l: Look) {
 const d = document.documentElement; d.dataset.palette = l.palette; d.dataset.board = l.board; d.dataset.pieces = l.pieces; d.dataset.font = l.font;
}
export function setLook(patch: Partial<Look>) {
 load(); current = valid({ ...current, ...patch });
 try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* optional */ }
 applyLook(current); subs.forEach(f => f());
}
export function useLook(): Look {
 return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => { load(); return current; }, () => defaultLook);
}
