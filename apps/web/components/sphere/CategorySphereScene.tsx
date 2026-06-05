/**
 * CategorySphereScene — R3F Scene inside the Canvas.
 *
 * v3: Discovery sphere — icon-based, high-density, billboarded, with rich tooltips.
 *
 * Performance rules:
 *  - Positions computed ONCE with useMemo (Fibonacci distribution)
 *  - Textures / materials created ONCE and disposed on unmount
 *  - useFrame updates rotation via refs (no state updates)
 *  - Icons billboard toward camera every frame
 *  - Semi-transparent shell sphere + low-poly wireframe for boundary clarity
 *  - Hover tooltip via drei Html (title + context)
 *  - Max 60 visible icons
 *  - Shared geometry, shared materials per unique name
 */

'use client';

import { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSphereStore } from '@/store/useSphereStore';
import { fibonacciSphere, createIconTexture, fillSphereNodes, getCategoryIcon } from './sphere.utils';
import { trackItemHover } from '@/lib/sphere/sphere-analytics';

const SPHERE_RADIUS = 2.4;
const ICON_COUNT = 60; // high density — max visible icons
const ICON_SIZE = 0.38; // size of each icon plane
const ROTATION_SPEED = 0.15; // rad/s — slow elegant rotation (~42s per revolution)
const FPS_SAMPLE_WINDOW = 90;

interface CategorySphereSceneProps {
  isMobile: boolean;
  onLowFPS?: () => void;
  onCategoryClick?: (name: string) => void;
  /** Categories selected via the filter panel — highlighted on the sphere */
  selectedFilterCategories?: string[];
}

export function CategorySphereScene({ isMobile, onLowFPS, onCategoryClick, selectedFilterCategories = [] }: CategorySphereSceneProps) {
  const visibleCategories = useSphereStore((s) => s.visibleCategories);
  const selectedCategory = useSphereStore((s) => s.selectedCategory);
  const setSelectedCategory = useSphereStore((s) => s.setSelectedCategory);
  const dock = useSphereStore((s) => s.dock);

  const { camera } = useThree();

  // ── Hover state — only one at a time ─────────────────────────────────────
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // ── Animation refs ───────────────────────────────────────────────────────
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);

  // ── FPS monitoring ───────────────────────────────────────────────────────
  const fpsHistory = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const lowFPSFired = useRef(false);
  const onLowFPSRef = useRef(onLowFPS);
  useEffect(() => { onLowFPSRef.current = onLowFPS; }, [onLowFPS]);

  // ── Set of filter-selected category names for O(1) lookup ────────────────
  const filterSelectedSet = useMemo(
    () => new Set(selectedFilterCategories),
    [selectedFilterCategories],
  );

  // ── Sphere nodes (categories duplicated to fill ICON_COUNT) ──────────────
  const sphereNodes = useMemo(
    () => fillSphereNodes(visibleCategories, ICON_COUNT),
    [visibleCategories],
  );

  // ── Positions (Fibonacci distribution — precomputed) ─────────────────────
  const positions = useMemo(
    () => fibonacciSphere(ICON_COUNT, SPHERE_RADIUS),
    [],
  );

  // ── Shared geometry for all icon planes (reused) ─────────────────────────
  const geometry = useMemo(() => new THREE.PlaneGeometry(ICON_SIZE, ICON_SIZE), []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  // ── Icon textures — one per unique category name ─────────────────────────
  const uniqueNames = useMemo(
    () => [...new Set(sphereNodes.map((n) => n.categoryName))],
    [sphereNodes],
  );
  const textureMap = useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    uniqueNames.forEach((name) => map.set(name, createIconTexture(name)));
    return map;
  }, [uniqueNames]);
  useEffect(() => () => { textureMap.forEach((t) => t.dispose()); }, [textureMap]);

  // ── Materials — one per unique category (shared across duplicates) ───────
  const materialMap = useMemo(() => {
    const map = new Map<string, THREE.MeshBasicMaterial>();
    textureMap.forEach((tex, name) => {
      map.set(
        name,
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.92,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
    });
    return map;
  }, [textureMap]);
  useEffect(() => () => { materialMap.forEach((m) => m.dispose()); }, [materialMap]);

  // ── Shell sphere materials (boundary visualization) ──────────────────────
  const shellMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#a78bfa'),
        transparent: true,
        opacity: 0.06,
        wireframe: false,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  );
  const wireframeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#a78bfa'),
        transparent: true,
        opacity: 0.12,
        wireframe: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => { shellMaterial.dispose(); wireframeMaterial.dispose(); }, [shellMaterial, wireframeMaterial]);

  // ── Rotation speed ───────────────────────────────────────────────────────
  const speed = isMobile ? ROTATION_SPEED * 0.7 : ROTATION_SPEED;

  // ── Reusable vector (avoids allocation in animation loop) ────────────────
  const _worldPos = useMemo(() => new THREE.Vector3(), []);

  // ── Main animation loop — no state updates here ──────────────────────────
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // FPS monitoring
    const now = performance.now();
    const fps = 1000 / (now - lastTimeRef.current);
    lastTimeRef.current = now;
    fpsHistory.current.push(fps);
    if (fpsHistory.current.length > FPS_SAMPLE_WINDOW) fpsHistory.current.shift();
    if (!lowFPSFired.current && fpsHistory.current.length === FPS_SAMPLE_WINDOW) {
      const avg = fpsHistory.current.reduce((a, b) => a + b, 0) / FPS_SAMPLE_WINDOW;
      if (avg < 40) {
        lowFPSFired.current = true;
        setTimeout(() => onLowFPSRef.current?.(), 0);
      }
    }

    // Smooth rotation
    rotationRef.current += delta * speed;
    groupRef.current.rotation.y = rotationRef.current;

    // Billboard every icon mesh toward the camera
    meshRefs.current.forEach((mesh) => {
      if (mesh) {
        mesh.getWorldPosition(_worldPos);
        mesh.lookAt(camera.position);
      }
    });
  });

  // ── Click handler ────────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (catName: string) => {
      setSelectedCategory(catName);
      onCategoryClick?.(catName);
      setTimeout(() => dock(), 50);
    },
    [setSelectedCategory, dock, onCategoryClick],
  );

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.4} castShadow={false} />

      {/* ── Semi-transparent shell sphere — defines clear boundary ── */}
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS + 0.15, 32, 32]} />
        <primitive object={shellMaterial} attach="material" />
      </mesh>
      <mesh>
        <sphereGeometry args={[SPHERE_RADIUS + 0.15, 16, 16]} />
        <primitive object={wireframeMaterial} attach="material" />
      </mesh>

      {/* ── Rotating group with discovery icons ── */}
      <group ref={groupRef}>
        {sphereNodes.map((node, idx) => {
          const [px, py, pz] = positions[idx] ?? [0, 0, 0];
          const mat = materialMap.get(node.categoryName);
          const isHovered = hoveredIdx === idx;
          const isSelected = node.categoryName === selectedCategory;
          const isFilterSelected = filterSelectedSet.has(node.categoryName);

          // Scale hierarchy: hover > filter-selected > sphere-selected > default
          const meshScale = isHovered ? 1.45 : isFilterSelected ? 1.35 : isSelected ? 1.25 : 1.0;

          return (
            <group key={`node-${idx}`} position={[px, py, pz]}>
              {/* Pulsing glow ring for filter-selected categories */}
              {isFilterSelected && (
                <mesh
                  scale={1.55}
                  renderOrder={-1}
                >
                  <ringGeometry args={[ICON_SIZE * 0.48, ICON_SIZE * 0.58, 32]} />
                  <meshBasicMaterial
                    color={getCategoryIcon(node.categoryName).bgColor}
                    transparent
                    opacity={0.7}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                  />
                </mesh>
              )}
              <mesh
                ref={(el) => { meshRefs.current[idx] = el; }}
                geometry={geometry}
                material={mat}
                scale={meshScale}
                onClick={(e) => {
                  e.stopPropagation();
                  handleNodeClick(node.categoryName);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                  setHoveredIdx(idx);
                  trackItemHover();
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'default';
                  setHoveredIdx(null);
                }}
              />
              {/* ── Rich tooltip — title + context on hover ── */}
              {isHovered && (
                <Html
                  center
                  distanceFactor={5}
                  style={{ pointerEvents: 'none' }}
                  zIndexRange={[100, 0]}
                >
                  <div
                    className="px-3 py-2 rounded-lg text-white shadow-lg whitespace-nowrap"
                    style={{
                      background: getCategoryIcon(node.categoryName).bgColor,
                      transform: 'translateY(-32px)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      backdropFilter: 'blur(4px)',
                      minWidth: '80px',
                      textAlign: 'center',
                    }}
                  >
                    <div className="text-xs font-semibold leading-tight">
                      {node.categoryName}
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '-5px',
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: '8px',
                        height: '8px',
                        background: getCategoryIcon(node.categoryName).bgColor,
                      }}
                    />
                  </div>
                </Html>
              )}
            </group>
          );
        })}
      </group>
    </>
  );
}
