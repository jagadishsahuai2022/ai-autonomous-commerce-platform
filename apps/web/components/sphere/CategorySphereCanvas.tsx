/**
 * CategorySphereCanvas — Next.js dynamic-import target (ssr: false).
 *
 * v2: Transparent background Canvas with optimised GL settings.
 */

'use client';

import { useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { CategorySphereScene } from './CategorySphereScene';

interface CategorySphereCanvasProps {
  isMobile: boolean;
  onLowFPS?: () => void;
  onCategoryClick?: (name: string) => void;
  selectedFilterCategories?: string[];
}

export default function CategorySphereCanvas({
  isMobile,
  onLowFPS,
  onCategoryClick,
  selectedFilterCategories = [],
}: CategorySphereCanvasProps) {
  const handleLowFPS = useCallback(() => {
    onLowFPS?.();
  }, [onLowFPS]);

  return (
    <Canvas
      gl={{
        antialias: true,
        powerPreference: 'default',
        stencil: false,
        depth: true,
        alpha: true,
      }}
      camera={{ position: [0, 0, 6], fov: 55, near: 0.1, far: 50 }}
      dpr={[1, 1.5]}
      frameloop="always"
      style={{
        background: 'transparent',
        width: '100%',
        height: '100%',
        display: 'block',
        position: 'absolute',
        inset: 0,
      }}
      onPointerMissed={() => { }}
    >
      <CategorySphereScene
        isMobile={isMobile}
        onLowFPS={handleLowFPS}
        onCategoryClick={onCategoryClick}
        selectedFilterCategories={selectedFilterCategories}
      />
    </Canvas>
  );
}
