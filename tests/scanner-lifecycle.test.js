import { afterEach, describe, expect, it, vi } from 'vitest';
import { startScanner } from '../src/scanner.js';

describe('scanner lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stops a late camera stream when scanner was cancelled before getUserMedia resolves', async () => {
    let resolveStream;
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    const getUserMedia = vi.fn(() => new Promise((resolve) => { resolveStream = resolve; }));

    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const video = { srcObject: null, play: vi.fn().mockResolvedValue(undefined), HAVE_ENOUGH_DATA: 4, readyState: 0 };
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn(), getImageData: vi.fn() }) };

    const scanner = startScanner(video, canvas, vi.fn());
    scanner.stop();
    resolveStream(stream);
    await Promise.resolve();
    await Promise.resolve();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.play).not.toHaveBeenCalled();
  });
});
