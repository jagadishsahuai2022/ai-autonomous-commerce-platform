/**
 * Vitest unit tests for sphere.utils — pure math + DOM functions.
 */

import { describe, it, expect } from 'vitest';
import {
  fibonacciSphere,
  outwardQuaternion,
  fillSphereNodes,
  getCategoryIcon,
} from '@/components/sphere/sphere.utils';
import * as THREE from 'three';

describe('fibonacciSphere', () => {
  it('returns exactly count positions', () => {
    expect(fibonacciSphere(6, 1)).toHaveLength(6);
    expect(fibonacciSphere(20, 2.2)).toHaveLength(20);
  });

  it('each point is approximately at the given radius', () => {
    const positions = fibonacciSphere(20, 2.2);
    for (const [x, y, z] of positions) {
      const r = Math.sqrt(x * x + y * y + z * z);
      expect(r).toBeCloseTo(2.2, 4);
    }
  });

  it('points are reasonably spread (min distance > 0)', () => {
    const positions = fibonacciSphere(6, 1);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const [x1, y1, z1] = positions[i];
        const [x2, y2, z2] = positions[j];
        const dist = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2);
        expect(dist).toBeGreaterThan(0.01);
      }
    }
  });

  it('handles count=1 without error', () => {
    expect(fibonacciSphere(1, 1)).toHaveLength(1);
  });

  it('handles count=0 without error', () => {
    expect(fibonacciSphere(0, 1)).toHaveLength(0);
  });
});

describe('outwardQuaternion', () => {
  it('returns a unit quaternion', () => {
    const q = outwardQuaternion(1, 0, 0);
    const len = Math.sqrt(q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2);
    expect(len).toBeCloseTo(1, 5);
  });

  it('plane facing +X rotates (0,0,1) to (1,0,0)', () => {
    const q = outwardQuaternion(1, 0, 0);
    const plane = new THREE.Vector3(0, 0, 1);
    plane.applyQuaternion(q);
    expect(plane.x).toBeCloseTo(1, 4);
    expect(plane.y).toBeCloseTo(0, 4);
    expect(plane.z).toBeCloseTo(0, 4);
  });

  it('plane facing +Y rotates (0,0,1) to (0,1,0)', () => {
    const q = outwardQuaternion(0, 1, 0);
    const plane = new THREE.Vector3(0, 0, 1);
    plane.applyQuaternion(q);
    expect(plane.x).toBeCloseTo(0, 4);
    expect(plane.y).toBeCloseTo(1, 4);
    expect(plane.z).toBeCloseTo(0, 4);
  });
});

describe('fillSphereNodes', () => {
  const cats = [
    { name: 'Electronics', count: 10 },
    { name: 'Books', count: 5 },
    { name: 'Sports', count: 3 },
  ];

  it('returns exact target count', () => {
    expect(fillSphereNodes(cats, 60)).toHaveLength(60);
  });

  it('duplicates round-robin when categories < targetCount', () => {
    const nodes = fillSphereNodes(cats, 7);
    expect(nodes[0].categoryName).toBe('Electronics');
    expect(nodes[1].categoryName).toBe('Books');
    expect(nodes[2].categoryName).toBe('Sports');
    expect(nodes[3].categoryName).toBe('Electronics'); // wraps
    expect(nodes[6].categoryName).toBe('Electronics'); // wraps again
  });

  it('returns empty for no categories', () => {
    expect(fillSphereNodes([], 10)).toHaveLength(0);
  });

  it('original index cycles correctly', () => {
    const nodes = fillSphereNodes(cats, 6);
    expect(nodes.map((n) => n.originalIndex)).toEqual([0, 1, 2, 0, 1, 2]);
  });
});

describe('getCategoryIcon', () => {
  it('returns known icon for Electronics', () => {
    const meta = getCategoryIcon('Electronics');
    expect(meta.bgColor).toBe('#6d28d9');
    expect(meta.paths.length).toBeGreaterThan(0);
  });

  it('returns default icon for unknown category', () => {
    const meta = getCategoryIcon('UnknownCat123');
    expect(meta.bgColor).toBe('#6b7280');
  });

  it('returns discovery type icon for trending', () => {
    const meta = getCategoryIcon('trending');
    expect(meta.bgColor).toBe('#ef4444');
    expect(meta.paths.length).toBeGreaterThan(0);
  });

  it('returns discovery type icon for deal', () => {
    const meta = getCategoryIcon('deal');
    expect(meta.bgColor).toBe('#f59e0b');
  });

  it('returns discovery type icon for limited_stock', () => {
    const meta = getCategoryIcon('limited_stock');
    expect(meta.bgColor).toBe('#dc2626');
  });
});
