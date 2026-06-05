/**
 * useSpherePerformance — Detects at runtime whether the device can sustain
 * 40+ FPS for the 3D category sphere.
 *
 * Downgrades gracefully when:
 *  - WebGL is unavailable
 *  - Device has < 4 CPU cores (low-end)
 *  - Calls onLowFPS after sphere is running and FPS drops below threshold
 */

'use client';

import { useEffect, useState } from 'react';

export interface SpherePerf {
  /** true = device can render 3D; false = use fallback */
  canUse3D: boolean;
  /** true while we're still checking */
  isLoading: boolean;
}

/**
 * Check once at mount time. Does NOT spin up an FPS-sample loop here;
 * the actual FPS monitoring lives inside the R3F Scene via onLowFPS callback.
 */
export function useSpherePerformance(): SpherePerf {
  const [state, setState] = useState<SpherePerf>({ canUse3D: false, isLoading: true });

  useEffect(() => {
    // 1. Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl =
        (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (!gl) {
        setState({ canUse3D: false, isLoading: false });
        return;
      }
    } catch {
      setState({ canUse3D: false, isLoading: false });
      return;
    }

    // 2. Check for low-end CPU (< 4 cores)
    const cores = navigator.hardwareConcurrency ?? 2;
    if (cores < 4) {
      setState({ canUse3D: false, isLoading: false });
      return;
    }

    // 3. Allow 3D rendering — FPS monitoring is done inside the sphere scene
    setState({ canUse3D: true, isLoading: false });
  }, []);

  return state;
}
