/**
 * Test setup for playback tests
 */

import { vi } from 'vitest';

// Mock requestAnimationFrame and cancelAnimationFrame
let frameId = 0;
const callbacks = new Map<number, FrameRequestCallback>();

globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback): number => {
  const id = ++frameId;
  callbacks.set(id, callback);
  
  // Execute callback asynchronously
  setTimeout(() => {
    const cb = callbacks.get(id);
    if (cb) {
      cb(performance.now());
      callbacks.delete(id);
    }
  }, 16); // ~60fps
  
  return id;
});

globalThis.cancelAnimationFrame = vi.fn((id: number): void => {
  callbacks.delete(id);
});
