"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { StoredFinding } from "@/lib/types";
import { resolveRegion, systemLabel, toBodyCoord } from "@/lib/regions";

// skeleton.glb is the source human-skeleton.glb (~26 MB) compressed with
// gltf-transform: 1024px WebP textures + meshopt geometry → ~1.28 MB, full body.
// The sibling overview-skeleton.glb turned out to be half-body (X bounds are
// asymmetric −0.34..0.07). human-skeleton.glb is kept in-repo as the source of
// truth if the compression pipeline needs re-running.
const TWIN_MODEL_URL = "/models/skeleton.glb";

interface Props {
  findings: StoredFinding[];
  activeId?: string;
  onSelect?: (id: string) => void;
  scanning?: boolean;
}

// r3f-based 3D digital twin. Uses a staged GLB asset when available and falls
// back to the procedural body so the reader never hard-fails if the model is
// missing or unsupported.
export function TwinScene({ findings, activeId, onSelect, scanning }: Props) {
  const [colors, setColors] = useState(() => defaultColors());
  const [modelState, setModelState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );

  // Pick up the current CSS-variable palette so the 3D scene matches the
  // rest of the app in light/dark mode.
  useEffect(() => {
    function sync() {
      const cs = getComputedStyle(document.documentElement);
      setColors({
        base: cssVar(cs, "--base") ?? "#eef0f3",
        surface: cssVar(cs, "--surface") ?? "#ffffff",
        surface2: cssVar(cs, "--surface-2") ?? "#f5f7fa",
        line: cssVar(cs, "--line") ?? "#dadfe6",
        ink: cssVar(cs, "--ink") ?? "#14171c",
        muted: cssVar(cs, "--muted") ?? "#8a94a2",
        accent: cssVar(cs, "--accent") ?? "#0f6e63",
        accent2: cssVar(cs, "--accent-2") ?? "#1a9485",
        flag: cssVar(cs, "--flag") ?? "#e0a030",
      });
    }
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  const pins = useMemo(
    () =>
      findings.map((f) => {
        const r = resolveRegion(f.bodySystem, f.region);
        const bc = toBodyCoord(r.x, r.y);
        return {
          finding: f,
          world: bodyCoordToWorld(bc),
          label: r.label,
        };
      }),
    [findings],
  );

  return (
    <div className="relative w-full h-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.05, 3.9], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[3, 4, 4]}
            intensity={0.7}
            color={colors.accent2}
          />
          <directionalLight
            position={[-3, 2, 2]}
            intensity={0.35}
            color={colors.accent}
          />

          <TwinBodyModel colors={colors} onStateChange={setModelState} />
          {scanning && <ScanBand colors={colors} />}

          {pins.map((p) => (
            <Pin
              key={p.finding.id}
              position={p.world}
              active={p.finding.id === activeId}
              reviewed={!!p.finding.reviewedAt}
              flag={p.finding.reviewRecommended}
              label={p.finding.finding}
              system={systemLabel(p.finding.bodySystem)}
              regionLabel={p.label}
              colors={colors}
              onSelect={() => onSelect?.(p.finding.id)}
            />
          ))}

          <ContactShadow colors={colors} />

          <OrbitControls
            enablePan={false}
            enableZoom
            minDistance={2.8}
            maxDistance={6}
            minPolarAngle={Math.PI / 3.4}
            maxPolarAngle={Math.PI / 1.9}
            enableDamping
            dampingFactor={0.09}
            target={[0, 0.95, 0]}
          />
        </Suspense>
      </Canvas>

      {/* Corner hint */}
      <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wider text-muted">
        drag to rotate · scroll to zoom
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] uppercase tracking-wider text-muted">
        {modelState === "loading"
          ? "loading skeleton model"
          : modelState === "failed"
            ? "fallback twin active"
            : "skeleton model active"}
      </div>
    </div>
  );
}

function TwinBodyModel({
  colors,
  onStateChange,
}: {
  colors: Colors;
  onStateChange: (state: "loading" | "loaded" | "failed") => void;
}) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    loader.setDRACOLoader(dracoLoader);
    // skeleton.glb ships with EXT_meshopt_compression; register the decoder
    // so the loader can inflate the geometry.
    loader.setMeshoptDecoder(MeshoptDecoder);
    onStateChange("loading");

    loader.load(
      TWIN_MODEL_URL,
      (gltf) => {
        if (cancelled) return;
        const source = gltf.scene || gltf.scenes?.[0];
        const root = source ? cloneSkeleton(source) : null;
        if (!root) {
          onStateChange("failed");
          return;
        }

        root.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.castShadow = true;
          child.receiveShadow = true;
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.metalness = Math.min(material.metalness ?? 0, 0.12);
            material.roughness = Math.max(material.roughness ?? 0.7, 0.75);
          }
        });

        normalizeTwinModel(root);
        setModel(root);
        onStateChange("loaded");
      },
      undefined,
      () => {
        if (cancelled) return;
        setModel(null);
        onStateChange("failed");
      },
    );

    return () => {
      cancelled = true;
      dracoLoader.dispose();
    };
  }, []);

  if (!model) {
    return (
      <>
        <Body colors={colors} />
        <AnatomyOverlay colors={colors} />
      </>
    );
  }

  return <primitive object={model} />;
}

function normalizeTwinModel(root: THREE.Object3D) {
  root.rotation.y = Math.PI;
  root.updateMatrixWorld(true);

  const initialBox = new THREE.Box3().setFromObject(root);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  if (initialSize.y <= 0) return;

  const targetHeight = 2.12;
  const scale = targetHeight / initialSize.y;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y += -0.26 - box.min.y;
  root.updateMatrixWorld(true);
}

// ---- Coord mapping ----

// bodyCoord {x: -0.5..0.5, y: 0..1 (head=0, feet=1), z: 0..1 (0 anterior)}
// → world { x, y, z } for a 2-unit-tall figure standing on y=0.
function bodyCoordToWorld(bc: {
  x: number;
  y: number;
  z: number;
}): [number, number, number] {
  const HEIGHT = 2.05;
  const WIDTH = 1.0;
  return [
    bc.x * WIDTH,
    HEIGHT - bc.y * HEIGHT,
    0.32 + bc.z * 0.15,
  ];
}

// ---- Body geometry ----

interface Colors {
  base: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  flag: string;
}

function Body({ colors }: { colors: Colors }) {
  const bodyRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!bodyRef.current) return;
    bodyRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.008;
  });
  return (
    <group ref={bodyRef}>
      {/* Head */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.18, 40, 40]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.62, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 0.12, 24]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.16, 0]}>
        <capsuleGeometry args={[0.29, 0.62, 12, 24]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Pelvis */}
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.24, 0.14, 12, 24]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Shoulders */}
      <mesh position={[-0.36, 1.44, 0]}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <BodyMat colors={colors} />
      </mesh>
      <mesh position={[0.36, 1.44, 0]}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Upper arms */}
      <Limb from={[-0.36, 1.44, 0]} to={[-0.44, 1.06, 0]} radius={0.075} colors={colors} />
      <Limb from={[0.36, 1.44, 0]} to={[0.44, 1.06, 0]} radius={0.075} colors={colors} />
      {/* Elbows */}
      <mesh position={[-0.44, 1.06, 0]}>
        <sphereGeometry args={[0.075, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      <mesh position={[0.44, 1.06, 0]}>
        <sphereGeometry args={[0.075, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Forearms */}
      <Limb from={[-0.44, 1.06, 0]} to={[-0.48, 0.7, 0]} radius={0.065} colors={colors} />
      <Limb from={[0.44, 1.06, 0]} to={[0.48, 0.7, 0]} radius={0.065} colors={colors} />
      {/* Hands */}
      <mesh position={[-0.48, 0.66, 0]}>
        <sphereGeometry args={[0.075, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      <mesh position={[0.48, 0.66, 0]}>
        <sphereGeometry args={[0.075, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Hips */}
      <mesh position={[-0.12, 0.5, 0]}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      <mesh position={[0.12, 0.5, 0]}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Thighs */}
      <Limb from={[-0.12, 0.5, 0]} to={[-0.14, 0.15, 0]} radius={0.1} colors={colors} />
      <Limb from={[0.12, 0.5, 0]} to={[0.14, 0.15, 0]} radius={0.1} colors={colors} />
      {/* Knees */}
      <mesh position={[-0.14, 0.15, 0]}>
        <sphereGeometry args={[0.085, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      <mesh position={[0.14, 0.15, 0]}>
        <sphereGeometry args={[0.085, 20, 20]} />
        <BodyMat colors={colors} />
      </mesh>
      {/* Calves */}
      <Limb from={[-0.14, 0.15, 0]} to={[-0.14, -0.2, 0]} radius={0.08} colors={colors} />
      <Limb from={[0.14, 0.15, 0]} to={[0.14, -0.2, 0]} radius={0.08} colors={colors} />
      {/* Feet */}
      <mesh position={[-0.14, -0.22, 0.06]} rotation={[Math.PI / 8, 0, 0]}>
        <boxGeometry args={[0.13, 0.06, 0.24]} />
        <BodyMat colors={colors} />
      </mesh>
      <mesh position={[0.14, -0.22, 0.06]} rotation={[Math.PI / 8, 0, 0]}>
        <boxGeometry args={[0.13, 0.06, 0.24]} />
        <BodyMat colors={colors} />
      </mesh>
    </group>
  );
}

function Limb({
  from,
  to,
  radius,
  colors,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  colors: Colors;
}) {
  // Position a capsule between two points.
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  // Capsule points up (+Y) by default; rotate so its axis aligns with `dir`.
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    up,
    dir.clone().normalize(),
  );
  return (
    <mesh position={mid.toArray()} quaternion={quat.toArray() as any}>
      <capsuleGeometry args={[radius, Math.max(len - radius * 2, 0.01), 8, 16]} />
      <BodyMat colors={colors} />
    </mesh>
  );
}

function BodyMat({ colors }: { colors: Colors }) {
  return (
    <meshStandardMaterial
      color={colors.surface}
      metalness={0.05}
      roughness={0.7}
      emissive={colors.accent}
      emissiveIntensity={0.02}
    />
  );
}

function AnatomyOverlay({ colors }: { colors: Colors }) {
  // Faint suggestion of internal structures — heart, lungs — so the front of
  // the chest reads as anatomical, not just a mannequin.
  return (
    <group>
      {/* Lungs */}
      <mesh position={[-0.14, 1.34, 0.19]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial
          color={colors.accent}
          transparent
          opacity={0.14}
          emissive={colors.accent}
          emissiveIntensity={0.08}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.14, 1.34, 0.19]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial
          color={colors.accent}
          transparent
          opacity={0.14}
          emissive={colors.accent}
          emissiveIntensity={0.08}
          depthWrite={false}
        />
      </mesh>
      {/* Heart */}
      <mesh position={[-0.03, 1.22, 0.22]}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshStandardMaterial
          color={colors.accent2}
          transparent
          opacity={0.35}
          emissive={colors.accent2}
          emissiveIntensity={0.18}
          depthWrite={false}
        />
      </mesh>
      {/* Brain glow */}
      <mesh position={[0, 1.86, 0.05]}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial
          color={colors.accent}
          transparent
          opacity={0.16}
          emissive={colors.accent}
          emissiveIntensity={0.12}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ScanBand({ colors }: { colors: Colors }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = (state.clock.elapsedTime % 1.8) / 1.8;
    ref.current.position.y = 2.1 - t * 2.4;
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      Math.sin(t * Math.PI) * 0.45;
  });
  return (
    <mesh ref={ref} position={[0, 1, 0]}>
      <boxGeometry args={[1.5, 0.06, 0.9]} />
      <meshBasicMaterial
        color={colors.accent}
        transparent
        opacity={0.25}
        depthWrite={false}
      />
    </mesh>
  );
}

function Pin({
  position,
  active,
  reviewed,
  flag,
  label,
  system,
  regionLabel,
  colors,
  onSelect,
}: {
  position: [number, number, number];
  active: boolean;
  reviewed: boolean;
  flag: boolean;
  label: string;
  system: string;
  regionLabel: string;
  colors: Colors;
  onSelect: () => void;
}) {
  const color = reviewed ? colors.muted : flag ? colors.flag : colors.accent;
  const ref = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ref.current) {
      const s = active ? 1.35 + Math.sin(state.clock.elapsedTime * 3) * 0.08 : 1;
      ref.current.scale.setScalar(s);
    }
    if (haloRef.current && !reviewed) {
      const t = (state.clock.elapsedTime % 2.4) / 2.4;
      const scale = 1 + t * 1.8;
      haloRef.current.scale.setScalar(scale);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, 0.32 - t * 0.32);
    }
  });

  return (
    <group position={position}>
      {!reviewed && (
        <mesh ref={haloRef}>
          <sphereGeometry args={[0.05, 20, 20]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.32}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[0.032, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1.2 : 0.7}
          roughness={0.3}
        />
      </mesh>
      <Html
        position={[0.12, 0.02, 0]}
        style={{
          transform: "translate(0, -50%)",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div
          className="text-[10.5px] leading-tight"
          style={{
            background: colors.surface,
            color: colors.ink,
            border: `1px solid ${colors.line}`,
            padding: "3px 6px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            boxShadow: `0 4px 12px -6px rgba(0,0,0,0.25)`,
            opacity: active ? 1 : 0.9,
          }}
        >
          <div style={{ fontWeight: 500 }}>{label}</div>
          <div style={{ color: colors.muted, fontSize: 9 }}>
            {system} · {regionLabel}
          </div>
        </div>
      </Html>
    </group>
  );
}

function ContactShadow({ colors }: { colors: Colors }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]}>
      <ringGeometry args={[0.4, 1.2, 40]} />
      <meshBasicMaterial
        color={colors.ink}
        transparent
        opacity={0.06}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---- utilities ----

function cssVar(cs: CSSStyleDeclaration, name: string): string | null {
  const raw = cs.getPropertyValue(name).trim();
  if (!raw) return null;
  // globals.css stores colors as "r g b" triplets, e.g. "15 110 99".
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  }
  return raw;
}

function defaultColors(): Colors {
  return {
    base: "#eef0f3",
    surface: "#ffffff",
    surface2: "#f5f7fa",
    line: "#dadfe6",
    ink: "#14171c",
    muted: "#8a94a2",
    accent: "#0f6e63",
    accent2: "#1a9485",
    flag: "#e0a030",
  };
}
