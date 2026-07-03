"use client";

import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Center, OrbitControls, Html } from "@react-three/drei";
import { GLTFLoader, DRACOLoader, MeshoptDecoder } from "three-stdlib";
import * as THREE from "three";
import Lenis from "lenis";

// ─── Colours ────────────────────────────────────────────────────────
const SCENE1_COLORS: Record<string, string> = {
  B1: "#c8956c", B2: "#6c9eb0", B3: "#8fad76", B4: "#b08ac8",
  B6: "#c8b46c", L11: "#c87a7a", Road: "#7a8a7a", Disc: "#8a9a8a",
};

// Keys ordered most-specific first so startsWith matching doesn't short-circuit
const SCENE3_COLORS: Record<string, string> = {
  "manufacturing unit": "#c8956c",  // B1 silo (orange-brown)
  "central office":     "#8fad76",  // B3 office (green)
  "dispatch zone":      "#b08ac8",  // B4 dispatch (purple)
  "heavy assembly":     "#c8b46c",  // B6 heavy assembly (golden)
  warehouse:            "#6c9eb0",  // B2 warehouse (blue-grey)
  "Material__1":        "#7a8a7a",  // ground plane (grey)
  trees2:               "#2d6a2d",  // forest terrain (dark green) — before "trees"
  trees:                "#4a8a4a",  // individual tree instances (green)
  Guideline:            "#c8c860",  // guideline floor paths (yellow-green)
  "Blk#2":              "#16a085",  // AMR-50 body (teal) — before "Blk"
  "White#2":            "#f5c842",  // AMR-10 accent (yellow) — before "White"
  "White#3":            "#1abc9c",  // AMR-50 accent (teal) — before "White"
  "grey#2":             "#117a65",  // AMR-50 detail (dark teal) — before "grey"
  Blk:                  "#2980b9",  // APT-20 body (blue)
  White:                "#4ab0d9",  // APT-20 accent (light blue)
  Black:                "#f39c12",  // AMR-10 body (orange)
  grey:                 "#888888",  // AMR-10 detail (grey)
  L11:                  "#c87a7a",  // L11 elements (red-pink)
  amr10:                "#8a9a8a",  // AMR-10 disc base (grey)
  B1:                   "#c8956c",  // B1 building shell fallback (orange-brown)
};

// Keys must be ordered most-specific first (startsWith matching)
const SCENE2_COLORS: Record<string, string> = {
  seng: "#6c9eb0",         // shelf structure
  kardus: "#c8956c",       // cardboard boxes
  catkuning: "#8a9a8a",    // floor paint
  kayubox: "#a07840",      // wooden crate
  besilis: "#8fad76",      // shelf panel
  DefaultLayer: "#b08ac8", // pallet station
  HITAMDOP: "#3a3a4a",     // loading dock
  Cube: "#b0a898",         // warehouse shell (walls / floor / ceiling)
  "Blk#2": "#16a085",      // AMR-50 body — before "Blk"
  "White#2": "#f5c842",    // AMR-10 accent — before "White"
  "White#3": "#1abc9c",    // AMR-50 accent — before "White"
  "grey#2": "#117a65",     // AMR-50 detail — before "grey"
  Blk: "#2980b9",          // APT-20 body
  Black: "#f39c12",        // AMR-10 body
  White: "#4ab0d9",        // APT-20 accent
  grey: "#888888",         // AMR-10 detail
};


function resolveColor(name: string, map: Record<string, string>): string | null {
  for (const key of Object.keys(map)) {
    if (name.toLowerCase().startsWith(key.toLowerCase())) return map[key];
  }
  return null;
}

// ─── Models ─────────────────────────────────────────────────────────
function buildScene(scene: THREE.Group, colors: Record<string, string>) {
  scene.traverse((child: any) => {
    if (child.isLight) { child.intensity = 0; child.visible = false; }
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const name: string = child.name || child.parent?.name || "";
      const color = resolveColor(name, colors) ?? resolveColor(child.parent?.name ?? "", colors);
      child.material = new THREE.MeshStandardMaterial({
        color: color ?? "#cccccc", roughness: 0.8, metalness: 0.05,
      });
      child.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(child.geometry, 20),
        new THREE.LineBasicMaterial({ color: "#1a1a1a", transparent: true, opacity: 0.4 })
      ));
    }
  });
  return scene;
}

// ─── Module-level pre-processing ────────────────────────────────────
// Scenes are loaded and processed here, at module load time, so by the time
// the user triggers a scene switch the expensive EdgesGeometry work is done.
const processedScenes = new Map<string, THREE.Group>();
const pendingLoads = new Map<string, Promise<void>>();

function makeLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(
    typeof MeshoptDecoder === "function" ? (MeshoptDecoder as () => unknown)() : MeshoptDecoder
  );
  return loader;
}

function initScene(url: string, colors: Record<string, string>): void {
  const p = makeLoader()
    .loadAsync(url)
    .then((gltf) => {
      buildScene(gltf.scene, colors);
      processedScenes.set(url, gltf.scene);
    });
  pendingLoads.set(url, p);
}

initScene("/wide_view_Virya_buildings.glb", SCENE1_COLORS);
pendingLoads.get("/wide_view_Virya_buildings.glb")!.then(() => {
  initScene("/virya-warehouse-interior.glb", SCENE2_COLORS);
  initScene("/virya first scene 2-optimized.glb", SCENE3_COLORS);
});

function useProcessedScene(url: string): THREE.Group {
  const cached = processedScenes.get(url);
  if (cached) return cached;
  const pending = pendingLoads.get(url);
  if (pending) throw pending; // Suspense catches this until the scene is ready
  throw new Error(`Scene not initialized: ${url}`);
}

function Scene1Model() {
  const scene = useProcessedScene("/wide_view_Virya_buildings.glb");
  return <Center><primitive object={scene} /></Center>;
}

function Scene3Model() {
  const scene = useProcessedScene("/virya first scene 2-optimized.glb");

  useEffect(() => {
    console.group("=== Scene 3 Object Inventory ===");
    scene.traverse((obj) => {
      const tag = [
        `name: "${obj.name || "(unnamed)"}"`,
        `type: ${obj.type}`,
        `pos: (${obj.position.x.toFixed(3)}, ${obj.position.y.toFixed(3)}, ${obj.position.z.toFixed(3)})`,
      ].join("  |  ");
      console.log(tag);
    });
    console.groupEnd();
  }, [scene]);

  return <Center><primitive object={scene} /></Center>;
}

function Scene2Model() {
  const scene = useProcessedScene("/virya-warehouse-interior.glb");

  useEffect(() => {
    console.group("=== Scene 2 Object Inventory ===");
    scene.traverse((obj) => {
      const tag = [
        `name: "${obj.name || "(unnamed)"}"`,
        `type: ${obj.type}`,
        `parent: "${obj.parent?.name || "(root)"}"`,
        `pos: (${obj.position.x.toFixed(3)}, ${obj.position.y.toFixed(3)}, ${obj.position.z.toFixed(3)})`,
      ].join("  |  ");
      console.log(tag);
    });
    console.groupEnd();
  }, [scene]);

  return <Center><primitive object={scene} /></Center>;
}

// ─── APT-20 animation: straight -Z slide ─────────────────────────────
const PHASE3_START = 0.85; // scroll threshold used by Scene2Setup camera phase
const ANIM_TRIGGER = 0.70; // model animation starts at this scroll value

function Scene2Animation({ scene2SmoothedRef }: { scene2SmoothedRef: React.MutableRefObject<number> }) {
  const { scene } = useThree();
  const discovered = useRef(false);
  type Part = { obj: THREE.Object3D; initPos: THREE.Vector3; initRotZ: number };
  const parts = useRef<Part[]>([]);

  useEffect(() => {
    discovered.current = false;
    parts.current = [];
    return () => {
      parts.current.forEach(({ obj, initPos, initRotZ }) => {
        obj.position.copy(initPos);
        obj.rotation.z = initRotZ;
      });
    };
  }, [scene]);

  useFrame(() => {
    if (scene2SmoothedRef.current < ANIM_TRIGGER) return;

    if (!discovered.current) {
      const all: Part[] = [];
      scene.traverse((obj: THREE.Object3D) => {
        const nm = obj.name ?? "";
        const isAptBody   = nm.startsWith("Blk") && !nm.startsWith("Blk#");
        const isAptAccent = nm.startsWith("White") && !nm.startsWith("White#");
        if (isAptBody || isAptAccent)
          all.push({ obj, initPos: obj.position.clone(), initRotZ: obj.rotation.z });
      });
      if (all.length === 0) return;

      // Two APT-20 instances — animate only the first one (lower position values)
      const xs = all.map(p => p.obj.position.x);
      const zs = all.map(p => p.obj.position.z);
      const axis = (Math.max(...xs) - Math.min(...xs)) >= (Math.max(...zs) - Math.min(...zs)) ? "x" : "z";
      all.sort((a, b) => a.obj.position[axis] - b.obj.position[axis]);
      parts.current = all.slice(0, Math.floor(all.length / 2));
      discovered.current = true;
    }

    const rawT = ((scene2SmoothedRef.current - ANIM_TRIGGER) / (1.0 - ANIM_TRIGGER)) * 1.2;
    const t = Math.max(Math.min(rawT, 1), 0);
    const ease = (x: number) => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;

    const SPLIT   = 0.75;  // end of phase 1 — model has travelled 1.5 units in -X
    const ROT_END = 0.875; // end of rotation sub-phase — 90° spin complete

    parts.current.forEach(({ obj, initPos, initRotZ }) => {
      if (t <= SPLIT) {
        // Phase 1: slide 1.5 units in -X
        const pct = ease(t / SPLIT);
        obj.position.x = initPos.x - pct * 1.5;
        obj.position.z = initPos.z;
        obj.rotation.z = initRotZ;
      } else if (t <= ROT_END) {
        // Phase 2a: rotate 90° about +Z in place — no movement
        const pct = ease((t - SPLIT) / (ROT_END - SPLIT));
        obj.position.x = initPos.x - 1.5;
        obj.position.z = initPos.z;
        obj.rotation.z = initRotZ + (Math.PI / 2) * pct;
      } else {
        // Phase 2b: move 0.5 units in +Z — cubic ease-out, holds final rotation
        const raw = (t - ROT_END) / (1.0 - ROT_END);
        const pct = 1 - Math.pow(1 - raw, 3);
        obj.position.x = initPos.x - 1.5;
        obj.position.z = initPos.z + pct * 0.5;
        obj.rotation.z = initRotZ + Math.PI / 2;
      }
    });
  });

  return null;
}

// ─── AMR-10 (yellow) animation ───────────────────────────────────────
const AMR10_TRIGGER = 0.40; // starts earlier than the APT-20 animation

function AMR10Animation({ scene2SmoothedRef }: { scene2SmoothedRef: React.MutableRefObject<number> }) {
  const { scene } = useThree();
  const discovered = useRef(false);
  const moveDist = useRef(10.0);
  const boundsComputed = useRef(false);
  type Part = {
    obj: THREE.Object3D;
    initWorldPos: THREE.Vector3;
    initLocalPos: THREE.Vector3;
    initLocalRotZ: number;
  };
  const parts = useRef<Part[]>([]);

  useEffect(() => {
    discovered.current = false;
    parts.current = [];
    return () => {
      parts.current.forEach(({ obj, initLocalPos, initLocalRotZ }) => {
        obj.position.copy(initLocalPos);
        obj.rotation.z = initLocalRotZ;
      });
    };
  }, [scene]);

  useFrame(() => {
    const t = scene2SmoothedRef.current;
    if (t < AMR10_TRIGGER) {
      if (discovered.current) {
        parts.current.forEach(({ obj, initLocalPos, initLocalRotZ }) => {
          obj.position.copy(initLocalPos);
          obj.rotation.z = initLocalRotZ;
        });
      }
      return;
    }

    if (!boundsComputed.current) {
      const box = new THREE.Box3();
      let meshCount = 0;
      scene.traverse((child: any) => {
        if (child.isMesh) { box.expandByObject(child); meshCount++; }
      });
      if (meshCount > 0) {
        const size = new THREE.Vector3();
        box.getSize(size);
        moveDist.current = size.z * 0.45;
        boundsComputed.current = true;
      }
    }

    if (!discovered.current) {
      type MeshInfo = { obj: THREE.Object3D; wx: number; wy: number; wz: number };
      const all: MeshInfo[] = [];
      scene.traverse((obj: THREE.Object3D) => {
        const nm = obj.name ?? "";
        if (nm.startsWith("Black") || nm.startsWith("White#2") || (nm.startsWith("grey") && !nm.startsWith("grey#"))) {
          const wp = new THREE.Vector3();
          obj.getWorldPosition(wp);
          all.push({ obj, wx: wp.x, wy: wp.y, wz: wp.z });
        }
      });
      if (all.length === 0) return;

      // Split two instances by finding largest gap along spread axis
      const wxSpread = Math.max(...all.map(p => p.wx)) - Math.min(...all.map(p => p.wx));
      const wzSpread = Math.max(...all.map(p => p.wz)) - Math.min(...all.map(p => p.wz));
      const ax = wxSpread >= wzSpread ? "wx" : "wz";
      all.sort((a, b) => a[ax] - b[ax]);
      let splitIdx = Math.floor(all.length / 2);
      let maxGap = 0;
      for (let i = 1; i < all.length; i++) {
        const gap = all[i][ax] - all[i - 1][ax];
        if (gap > maxGap) { maxGap = gap; splitIdx = i; }
      }
      const instance = all.slice(splitIdx);

      // Compute world-space centroid (cx, cz) of this instance
      const cx = instance.reduce((s, p) => s + p.wx, 0) / instance.length;
      const cz = instance.reduce((s, p) => s + p.wz, 0) / instance.length;

      parts.current = instance.map(({ obj }) => {
        const initWorldPos = new THREE.Vector3();
        obj.getWorldPosition(initWorldPos);
        return {
          obj,
          initWorldPos,
          initLocalPos: obj.position.clone(),
          initLocalRotZ: obj.rotation.z,
        };
      });
      discovered.current = true;
    }

    const ease = (x: number) => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;

    const TURN_START = 0.67;
    const cameraSpeed = moveDist.current / TURN_START; // world units per scroll unit
    const robotSpeed = cameraSpeed * 1.43; // 45% faster than the camera
    const robotSpeedAfter = cameraSpeed * 2.70; // 2.70x faster translation after pause
    const robotSpeedX = cameraSpeed * 7.00;

    const T1_START    = 0.40;
    const duration1   = 2.7 / robotSpeed;
    const T1_END      = T1_START + duration1;
    const T_HOLD_END  = T1_END + 0.08; // increased pause scroll window by 0.06 (~1s scroll time)
    const duration2   = 0.7 / robotSpeedAfter;
    const T2_END      = T_HOLD_END + duration2;
    const T_ROT_END   = T2_END + 0.015;
    const duration3   = 2.0 / robotSpeedX;
    const T_X_END     = T_ROT_END + duration3;

    // Compute Z travel distance
    let distZ = 0;
    if (t <= T1_START) {
      distZ = 0;
    } else if (t <= T1_END) {
      const pct = (t - T1_START) / duration1;
      const easedPct = 1 - Math.pow(1 - pct, 2); // quadratic ease-out braking deceleration
      distZ = easedPct * 2.7;
    } else if (t <= T_HOLD_END) {
      distZ = 2.7;
    } else if (t <= T2_END) {
      distZ = 2.7 + (t - T_HOLD_END) * robotSpeedAfter;
    } else {
      distZ = 3.4;
    }

    // Compute rotation (Segment 4)
    let rot = 0;
    if (t > T2_END) {
      const pct = Math.min((t - T2_END) / (T_ROT_END - T2_END), 1);
      rot = ease(pct) * (Math.PI / 2);
    }

    // Compute X travel distance along turned direction (Segment 5)
    let distX = 0;
    if (t > T_ROT_END) {
      const pct = Math.min((t - T_ROT_END) / (T_X_END - T_ROT_END), 1);
      distX = pct * 2.0;
    }

    // Compute initial centroid horizontal coordinates from static records
    const cx = parts.current.reduce((s, p) => s + p.initWorldPos.x, 0) / parts.current.length;
    const cz = parts.current.reduce((s, p) => s + p.initWorldPos.z, 0) / parts.current.length;

    parts.current.forEach(({ obj, initWorldPos, initLocalPos, initLocalRotZ }) => {
      // 1. Calculate relative offset from initial world centroid (cx, cz) on the XZ plane
      const offset = new THREE.Vector3(
        initWorldPos.x - cx,
        0,
        initWorldPos.z - cz
      );

      // 2. Rotate offset in the XZ plane around world vertical Y axis
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);

      // 3. Construct target position in world space (translate along negative Z axis and negative X axis)
      const targetWorld = new THREE.Vector3(
        cx + offset.x - distX,
        initWorldPos.y, // preserve initial world height
        cz + offset.z - distZ
      );

      // 4. Convert target position to local space of the parent
      if (obj.parent) {
        obj.parent.updateWorldMatrix(true, false);
        obj.position.copy(obj.parent.worldToLocal(targetWorld));
      } else {
        obj.position.copy(targetWorld);
      }

      // 5. Apply local rotation
      obj.rotation.z = initLocalRotZ + rot;
    });
  });

  return null;
}


// ─── APT-20 (second instance) pickup animation ───────────────────────
// Robot nudges forward then the 2 nearest boxes rise up onto it.
const APT20B_TRIGGER = 0.22;

function APT20PickupAnimation({ scene2SmoothedRef }: { scene2SmoothedRef: React.MutableRefObject<number> }) {
  const { scene } = useThree();
  const discovered = useRef(false);
  type RobotPart = { obj: THREE.Object3D; initPos: THREE.Vector3 };
  type Box = { obj: THREE.Object3D; initPos: THREE.Vector3 };
  const robot = useRef<RobotPart[]>([]);
  const boxes = useRef<Box[]>([]);

  useEffect(() => {
    discovered.current = false;
    robot.current = [];
    boxes.current = [];
    return () => {
      robot.current.forEach(({ obj, initPos }) => obj.position.copy(initPos));
      boxes.current.forEach(({ obj, initPos }) => obj.position.copy(initPos));
    };
  }, [scene]);

  useFrame(() => {
    if (scene2SmoothedRef.current < APT20B_TRIGGER) return;

    if (!discovered.current) {
      // Collect all APT-20 parts
      const allApt: RobotPart[] = [];
      scene.traverse((obj: THREE.Object3D) => {
        const nm = obj.name ?? "";
        const isAptBody   = nm.startsWith("Blk") && !nm.startsWith("Blk#");
        const isAptAccent = nm.startsWith("White") && !nm.startsWith("White#");
        if (isAptBody || isAptAccent) allApt.push({ obj, initPos: obj.position.clone() });
      });
      if (allApt.length === 0) return;

      // Second instance = higher half along spread axis
      const xs = allApt.map(p => p.obj.position.x);
      const zs = allApt.map(p => p.obj.position.z);
      const axis = (Math.max(...xs) - Math.min(...xs)) >= (Math.max(...zs) - Math.min(...zs)) ? "x" : "z";
      allApt.sort((a, b) => a.obj.position[axis] - b.obj.position[axis]);
      robot.current = allApt.slice(Math.floor(allApt.length / 2));

      // Centroid of the second APT-20
      const center = new THREE.Vector3();
      robot.current.forEach(({ obj }) => center.add(obj.position));
      center.divideScalar(robot.current.length);

      // Find the 2 nearest non-robot mesh objects to this robot
      // (boxes appear white/grey = no matching color key → default #cccccc)
      const isRobotPart = (nm: string) =>
        (nm.startsWith("Blk") && !nm.startsWith("Blk#")) ||
        (nm.startsWith("White") && !nm.startsWith("White#")) ||
        nm.startsWith("Blk#2") || nm.startsWith("White#3") || nm.startsWith("grey#2") ||
        nm.startsWith("Black") || nm.startsWith("White#2") ||
        (nm.startsWith("grey") && !nm.startsWith("grey#")) ||
        nm.startsWith("seng") || nm.startsWith("catkuning") || nm.startsWith("besilis") ||
        nm.startsWith("DefaultLayer") || nm.startsWith("HITAMDOP") || nm.startsWith("kardus");

      const allBoxes: Box[] = [];
      scene.traverse((obj: THREE.Object3D) => {
        if (!(obj as any).isMesh) return;
        const nm = obj.name ?? "";
        if (!isRobotPart(nm)) allBoxes.push({ obj, initPos: obj.position.clone() });
      });
      allBoxes.sort((a, b) => a.obj.position.distanceTo(center) - b.obj.position.distanceTo(center));
      boxes.current = allBoxes.slice(0, 2);

      discovered.current = true;
    }

    const t = Math.min((scene2SmoothedRef.current - APT20B_TRIGGER) / (1.0 - APT20B_TRIGGER), 1);
    const ease = (x: number) => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;

    const movePct = ease(Math.min(t / 0.35, 1));

    robot.current.forEach(({ obj, initPos }) => {
      obj.position.z = initPos.z - movePct * 0.15;
    });
  });

  return null;
}

// ─── Scene 3 camera ──────────────────────────────────────────────────
const S3_A_POS    = new THREE.Vector3(-13.264,  1.074, -10.294);
const S3_A_TARGET = new THREE.Vector3(-12.535,  0.863, -10.577);
const S3_B_POS    = new THREE.Vector3(-13.264,  1.074, -0.082);
const S3_B_TARGET = new THREE.Vector3( -9.879,  0.160, -0.602);

function Scene3Camera({
  scene3SmoothedRef,
  scene3ScrollRef,
}: {
  scene3SmoothedRef: React.MutableRefObject<number>;
  scene3ScrollRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const scene3Smoothed = useRef(0);

  useEffect(() => {
    camera.position.copy(S3_A_POS);
    camera.lookAt(S3_A_TARGET);
  }, [camera]);

  useFrame((_, delta) => {
    scene3Smoothed.current += (scene3ScrollRef.current - scene3Smoothed.current) * (1 - Math.exp(-delta * 4));
    scene3SmoothedRef.current = scene3Smoothed.current;
    const ease = scene3Smoothed.current * scene3Smoothed.current * (3 - 2 * scene3Smoothed.current);
    camera.position.lerpVectors(S3_A_POS, S3_B_POS, ease);
    camera.lookAt(new THREE.Vector3().lerpVectors(S3_A_TARGET, S3_B_TARGET, ease));
  });

  return null;
}

// ─── Scene 3 yellow robot follows the camera on scroll ───────────────
const S3_DISPLACEMENT = new THREE.Vector3().subVectors(S3_B_POS, S3_A_POS); // world-space travel vector

function Scene3ModelAnimation({ scene3SmoothedRef }: { scene3SmoothedRef: React.MutableRefObject<number> }) {
  const { scene } = useThree();
  const discovered = useRef(false);
  type Part = { obj: THREE.Object3D; initWorldPos: THREE.Vector3; initLocalPos: THREE.Vector3 };
  const parts = useRef<Part[]>([]);

  useEffect(() => {
    discovered.current = false;
    parts.current = [];
    return () => {
      // Restore local positions so the processedScenes cache stays clean
      parts.current.forEach(({ obj, initLocalPos }) => obj.position.copy(initLocalPos));
    };
  }, [scene]);

  useFrame(() => {
    if (!discovered.current) {
      const all: Part[] = [];
      scene.traverse((obj: THREE.Object3D) => {
        if (!(obj as any).isMesh) return;
        const nm = obj.name ?? "";
        const isYellow =
          nm.startsWith("amr10") ||
          nm.startsWith("Black") ||
          nm.startsWith("White#2") ||
          (nm.startsWith("grey") && !nm.startsWith("grey#"));
        if (!isYellow) return;
        const initWorldPos = new THREE.Vector3();
        obj.getWorldPosition(initWorldPos);
        all.push({ obj, initWorldPos, initLocalPos: obj.position.clone() });
      });
      if (all.length === 0) return;
      parts.current = all;
      discovered.current = true;
    }

    const s = Math.min(scene3SmoothedRef.current * 1.25, 1);
    const ease = s * s * (3 - 2 * s);
    parts.current.forEach(({ obj, initWorldPos }) => {
      // Compute target in world space, then convert to parent's local space
      const targetWorld = initWorldPos.clone().addScaledVector(S3_DISPLACEMENT, ease);
      if (obj.parent) {
        obj.parent.updateWorldMatrix(true, false);
        obj.position.copy(obj.parent.worldToLocal(targetWorld));
      } else {
        obj.position.copy(targetWorld);
      }
    });
  });

  return null;
}

// ─── Scene 3 free-cam (dev tool: orbit freely to find landing angle) ─
function Scene3FreeCam({
  posRef,
  targetRef,
}: {
  posRef: React.RefObject<HTMLSpanElement | null>;
  targetRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const seeded = useRef(false);

  useFrame(() => {
    if (!seeded.current && controlsRef.current) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      controlsRef.current.target.copy(
        camera.position.clone().addScaledVector(dir, 10)
      );
      controlsRef.current.update();
      seeded.current = true;
    }
    if (posRef.current) {
      const { x, y, z } = camera.position;
      posRef.current.textContent = `${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}`;
    }
    if (targetRef.current && controlsRef.current) {
      const { x, y, z } = controlsRef.current.target;
      targetRef.current.textContent = `${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}`;
    }
  });

  return <OrbitControls ref={controlsRef} />;
}

// ─── Scroll camera (scene 1 only) ───────────────────────────────────
const START_POS = new THREE.Vector3(-6, 4, 3);
const START_LOOK = new THREE.Vector3(0, 0, 0);

function ScrollCamera({
  scrollRef,
}: {
  scrollRef: React.MutableRefObject<number>;
}) {
  const { camera, scene } = useThree();
  const ready = useRef(false);
  const smoothed = useRef(scrollRef.current);
  const endPos = useRef(new THREE.Vector3());
  const endLook = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!ready.current) {
      scene.traverse((child: any) => {
        if (ready.current || !child.isMesh) return;
        const nm = (child.name + " " + (child.parent?.name ?? "")).toLowerCase();
        if (!nm.includes("b4")) return;
        const box = new THREE.Box3().setFromObject(child);
        const ctr = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(ctr); box.getSize(size);
        const standoff = Math.max(size.x, size.z, 0.5) * 0.75;
        endPos.current.set(ctr.x - size.x * 0.3, box.max.y + size.y * 0.4, ctr.z + standoff);
        endLook.current.set(ctr.x, box.max.y, ctr.z);
        ready.current = true;
      });
      if (!ready.current) return;
    }
    smoothed.current += (scrollRef.current - smoothed.current) * (1 - Math.exp(-delta * 4));
    const ease = smoothed.current * smoothed.current * (3 - 2 * smoothed.current);
    camera.position.lerpVectors(START_POS, endPos.current, ease);
    const targetLook = new THREE.Vector3().lerpVectors(START_LOOK, endLook.current, ease);
    camera.lookAt(targetLook);
  });

  return null;
}

// ─── Fade controller (lives inside Canvas, writes to DOM ref) ────────
const transitionState = {
  phase: "idle" as "idle" | "out" | "in",
  progress: 0,
  targetScene: null as 1 | 2 | 3 | null,
};

function FadeController({
  overlayRef,
  onSwitch,
}: {
  overlayRef: React.RefObject<HTMLDivElement | null>;
  onSwitch: (target: 1 | 2 | 3) => void;
}) {
  const switched = useRef(false);

  useFrame((_, delta) => {
    if (transitionState.phase === "out") {
      transitionState.progress = Math.min(transitionState.progress + delta * 5.0, 1);
      if (overlayRef.current) overlayRef.current.style.opacity = String(transitionState.progress);

      if (transitionState.progress >= 1 && !switched.current) {
        switched.current = true;
        if (transitionState.targetScene !== null) {
          onSwitch(transitionState.targetScene as 1 | 2 | 3);
        }
      }
    } else if (transitionState.phase === "in") {
      switched.current = false;
      transitionState.progress = Math.max(transitionState.progress - delta * 4.0, 0);
      if (overlayRef.current) overlayRef.current.style.opacity = String(transitionState.progress);
      if (transitionState.progress <= 0) {
        transitionState.phase = "idle";
        transitionState.targetScene = null;
      }
    }
  });

  return null;
}

// ─── Temporary: show live camera position so we can hardcode it ──────
// ─── Scene 2: reset camera to overview on mount ──────────────────────
function Scene2Setup({
  scene2SmoothedRef,
  scene2ScrollRef,
}: {
  scene2SmoothedRef: React.MutableRefObject<number>;
  scene2ScrollRef: React.MutableRefObject<number>;
}) {
  const { camera, scene } = useThree();
  const scene2Smoothed = useRef(0);

  const basePos = useRef(new THREE.Vector3());
  const baseLook = useRef(new THREE.Vector3());
  const rightVec = useRef(new THREE.Vector3());
  const forwardVec = useRef(new THREE.Vector3());
  const initialized = useRef(false);
  const moveDist = useRef(10.0);
  const modelXSize = useRef(10.0);
  const boundsComputed = useRef(false);

  useEffect(() => {
    basePos.current.set(2.551, 1.645, 3.023);
    baseLook.current.set(-0.440, -0.010, 0.449);
    rightVec.current.set(1, 0, 0);
    forwardVec.current.set(0, 0, -1);

    camera.position.copy(basePos.current);
    camera.lookAt(baseLook.current);
    initialized.current = true;
  }, [camera]);

  useFrame((_, delta) => {
    if (!initialized.current) return;

    if (!boundsComputed.current) {
      const box = new THREE.Box3();
      let meshCount = 0;
      scene.traverse((child: any) => {
        if (child.isMesh) { box.expandByObject(child); meshCount++; }
      });
      if (meshCount > 0) {
        const size = new THREE.Vector3();
        box.getSize(size);
        moveDist.current = size.z * 0.45;  // slightly further than before
        modelXSize.current = size.x;
        boundsComputed.current = true;
      }
    }

    scene2Smoothed.current += (scene2ScrollRef.current - scene2Smoothed.current) * (1 - Math.exp(-delta * 4));
    scene2SmoothedRef.current = scene2Smoothed.current;
    const t = scene2Smoothed.current;

    // Three-phase camera path
    const TURN_START = 0.67;  // forward travel ends here
    const TURN_END = 0.90;  // 90° left turn completes here
    // Phase 3: t = TURN_END → 1.0, side travel along −X aisle

    const ss = (x: number) => x * x * (3 - 2 * x); // smoothstep

    // Capped height rise and dynamic left focus parameters
    const HEIGHT_RISE = 0.1;       // maximum camera height rise
    const LATERAL_DRIFT_AMOUNT = 1.5; // maximum diagonal lateral drift to the left
    const EXTRA_LEFT_SHIFT = 9.0;  // maximum leftward pan/focus shift at peak height

    // Timeline phases within Phase 1:
    const T_HEIGHT_DRIFT_END = 0.20; // Height rise and diagonal drift finish at 20% scroll
    const T_PAN_START = 0.20; // Panning target leftward starts at 20% scroll
    const T_PAN_END = 0.40; // Panning target finishes at 40% scroll

    // Pullback along +right (away from interior) during 20–40% for a broader view
    const PULLBACK_AMOUNT = 0.7;
    const PULL_UP_AMOUNT = 1.0;       // Y lift (~7.5% of base height)
    const LEFT_ROTATE = Math.PI / 18; // 10°
    const DOWN_PITCH = Math.PI / 6; // 30° downward angle bend
    const pullbackPct = t > T_HEIGHT_DRIFT_END
      ? Math.min((t - T_HEIGHT_DRIFT_END) / (T_PAN_END - T_HEIGHT_DRIFT_END), 1.0)
      : 0;
    const currentPullback = rightVec.current.clone().multiplyScalar(pullbackPct * PULLBACK_AMOUNT);

    // Rotate a look direction left (around Y) then pitch it down (around local right)
    const applyAngle = (dir: THREE.Vector3, leftFrac: number, downFrac: number) => {
      const yUp = new THREE.Vector3(0, 1, 0);
      // positive angle = clockwise from above = leftward turn for this camera orientation
      dir.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(yUp, leftFrac * LEFT_ROTATE));
      // cross(dir, yUp) gives camera right axis; negative angle around right = pitch down
      const rAxis = new THREE.Vector3().crossVectors(dir, yUp).normalize();
      dir.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(rAxis, -downFrac * DOWN_PITCH));
      return dir;
    };

    // 1. Calculate height rise offset based on scroll progress
    const heightPct = Math.min(t / T_HEIGHT_DRIFT_END, 1.0);
    const currentHeightOffset = heightPct * HEIGHT_RISE;

    // 2. Calculate diagonal sideways drift offset based on scroll progress
    const driftPct = Math.min(t / T_HEIGHT_DRIFT_END, 1.0);
    const currentSidewaysDrift = rightVec.current.clone().multiplyScalar(-driftPct * LATERAL_DRIFT_AMOUNT);

    // 3. Calculate left focus shift (angle panning) starting after height/drift are complete
    let panPct = 0;
    if (t > T_PAN_START) {
      panPct = Math.min((t - T_PAN_START) / (T_PAN_END - T_PAN_START), 1.0);
    }
    const currentLeftShift = rightVec.current.clone().multiplyScalar(-panPct * EXTRA_LEFT_SHIFT);

    const sideDrift = rightVec.current.clone().multiplyScalar(-LATERAL_DRIFT_AMOUNT);
    const EXTRA_PARALLEL = 0.75; // extended parallel distance (Phase 2)
    const EXTRA_DOLLY    = 0.55;  // Phase 3 dolly distance along facing direction

    // Anchor: end of Phase 2 parallel (= Phase 3 start)
    const parallelEndFwdOffset = forwardVec.current.clone().multiplyScalar((1.0 + EXTRA_PARALLEL) * moveDist.current);
    const camAtParallelEnd = new THREE.Vector3().addVectors(basePos.current, parallelEndFwdOffset).add(sideDrift);
    camAtParallelEnd.add(rightVec.current.clone().multiplyScalar(PULLBACK_AMOUNT));
    camAtParallelEnd.y += HEIGHT_RISE + PULL_UP_AMOUNT;

    // Phase 3 look direction: same as Phase 2 end (parallel look with applyAngle)
    const parallelEndFwdLook = new THREE.Vector3().addVectors(baseLook.current, parallelEndFwdOffset).add(sideDrift).add(
      rightVec.current.clone().multiplyScalar(-EXTRA_LEFT_SHIFT)
    );
    const phase3Dir = applyAngle(
      new THREE.Vector3().subVectors(parallelEndFwdLook, camAtParallelEnd).normalize(), 1, 1
    );

    if (t <= TURN_START) {
      // Phase 1 — diagonal entry then parallel forward travel
      const pct = t / TURN_START;

      const forwardOffset = forwardVec.current.clone().multiplyScalar(pct * moveDist.current);
      const currentOffset = new THREE.Vector3().addVectors(forwardOffset, currentSidewaysDrift);

      const camPos = new THREE.Vector3().addVectors(basePos.current, currentOffset);
      camPos.add(currentPullback);
      camPos.y += currentHeightOffset + pullbackPct * PULL_UP_AMOUNT;
      camera.position.copy(camPos);

      const lookTarget = new THREE.Vector3().addVectors(baseLook.current, currentOffset).add(currentLeftShift);
      const lookDir1 = applyAngle(new THREE.Vector3().subVectors(lookTarget, camPos).normalize(), pullbackPct, pullbackPct);
      camera.lookAt(camPos.clone().add(lookDir1.multiplyScalar(20)));

    } else if (t <= PHASE3_START) {
      // Phase 2 — extended parallel forward
      const pct = (t - TURN_START) / (PHASE3_START - TURN_START);
      const fwdPct = 1.0 + pct * EXTRA_PARALLEL;
      const currentFwdOffset = forwardVec.current.clone().multiplyScalar(fwdPct * moveDist.current);
      const camPos = new THREE.Vector3().addVectors(basePos.current, currentFwdOffset).add(sideDrift);
      camPos.add(rightVec.current.clone().multiplyScalar(PULLBACK_AMOUNT));
      camPos.y += HEIGHT_RISE + PULL_UP_AMOUNT;
      camera.position.copy(camPos);

      const parallelLook = new THREE.Vector3().addVectors(baseLook.current, currentFwdOffset).add(sideDrift).add(
        rightVec.current.clone().multiplyScalar(-EXTRA_LEFT_SHIFT)
      );
      const lookDir2 = applyAngle(new THREE.Vector3().subVectors(parallelLook, camPos).normalize(), 1, 1);
      camera.lookAt(camPos.clone().add(lookDir2.multiplyScalar(20)));

    } else {
      // Phase 3 — translate horizontally in the direction the camera is facing (no zoom)
      const DOLLY_START = PHASE3_START;
      const pct = t > DOLLY_START ? ss((t - DOLLY_START) / (1.0 - DOLLY_START)) : 0;
      // Use only the horizontal (XZ) component of the facing direction so height stays locked
      const phase3MoveDir = new THREE.Vector3(phase3Dir.x, 0, phase3Dir.z).normalize();
      const moveOffset = phase3MoveDir.clone().multiplyScalar(pct * EXTRA_DOLLY * moveDist.current);
      const camPos = new THREE.Vector3().addVectors(camAtParallelEnd, moveOffset);
      camera.position.copy(camPos);
      // Look target moves with the camera by the same offset → angle stays constant, no zoom
      camera.lookAt(camPos.clone().add(phase3Dir.clone().multiplyScalar(20)));
    }
  });

  return null; // Camera is fully locked (no OrbitControls)
}

// ─── Main component ──────────────────────────────────────────────────
export default function ModelViewer() {
  const [activeScene, setActiveScene] = useState<1 | 2 | 3>(1);
  const [freeCam3, setFreeCam3] = useState(false);
  const scrollRef = useRef(0);
  const scene2ScrollRef = useRef(0);
  const scene3ScrollRef = useRef(0);
  const scene2SmoothedRef = useRef(0);
  const scene3SmoothedRef = useRef(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const camPosSpan = useRef<HTMLSpanElement>(null);
  const camTargetSpan = useRef<HTMLSpanElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const handleSwitch = useCallback((target: 1 | 2 | 3) => {
    setActiveScene(target);
    const lenis = lenisRef.current;
    if (lenis) {
      const maxScroll = lenis.limit;
      if (target === 1) {
        lenis.scrollTo(0.32 * maxScroll, { immediate: true });
        scrollRef.current = 0.97;
        if (progressRef.current) progressRef.current.style.width = "97%";
      } else if (target === 2) {
        if (activeScene === 1) {
          lenis.scrollTo(0.33 * maxScroll, { immediate: true });
          scene2ScrollRef.current = 0;
        } else {
          lenis.scrollTo(0.65 * maxScroll, { immediate: true });
          scene2ScrollRef.current = 0.97;
        }
      } else if (target === 3) {
        lenis.scrollTo(0.66 * maxScroll, { immediate: true });
        scene3ScrollRef.current = 0;
      }
    }
    // start fade-in after a short delay to let scene mount
    setTimeout(() => {
      transitionState.phase = "in";
      transitionState.progress = 1;
    }, 50);
  }, [activeScene]);

  useEffect(() => {
    // 1. Initialize Lenis on the window
    const lenis = new Lenis({
      duration: 2.2, // longer easing duration for buttery slow scroll
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // ultra smooth easing
      gestureOrientation: "vertical",
      wheelMultiplier: 0.28, // capped speed to ensure even max-power scroll only covers half of scene 1
      touchMultiplier: 0.8,
    });
    lenisRef.current = lenis;

    // Scroll back to top on refresh
    window.scrollTo(0, 0);

    // 2. Ticker inside requestAnimationFrame
    let rafId: number;
    let isStopped = false;
    function raf(time: number) {
      const targetStopped = transitionState.phase !== "idle";
      if (targetStopped !== isStopped) {
        isStopped = targetStopped;
        if (isStopped) lenis.stop();
        else lenis.start();
      }
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;

    const handleScroll = (e: any) => {
      if (transitionState.phase !== "idle") {
        lenis.stop();
        return;
      }

      const progress = e.progress; // 0 to 1
      const maxScroll = lenis.limit;

      if (activeScene === 1) {
        // Scene 1: range [0.00, 0.33]
        if (progress >= 0.33) {
          lenis.stop();
          transitionState.phase = "out";
          transitionState.progress = 0;
          transitionState.targetScene = 2;
        } else {
          const local = Math.min(Math.max(progress / 0.33, 0), 1);
          scrollRef.current = local;
          if (progressRef.current) {
            progressRef.current.style.width = `${local * 100}%`;
          }
        }
      } else if (activeScene === 2) {
        // Scene 2: range [0.33, 0.66]
        if (progress >= 0.66) {
          lenis.stop();
          transitionState.phase = "out";
          transitionState.progress = 0;
          transitionState.targetScene = 3;
        } else if (progress <= 0.28) {
          lenis.stop();
          transitionState.phase = "out";
          transitionState.progress = 0;
          transitionState.targetScene = 1;
        } else {
          const local = Math.min(Math.max((progress - 0.33) / 0.33, 0), 1);
          scene2ScrollRef.current = local;
        }
      } else if (activeScene === 3) {
        // Scene 3: range [0.66, 1.00]
        if (progress <= 0.61) {
          lenis.stop();
          transitionState.phase = "out";
          transitionState.progress = 0;
          transitionState.targetScene = 2;
        } else {
          const local = Math.min(Math.max((progress - 0.66) / 0.34, 0), 1);
          scene3ScrollRef.current = local;
        }
      }
    };

    lenis.on("scroll", handleScroll);
    return () => {
      lenis.off("scroll", handleScroll);
    };
  }, [activeScene]);

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Fixed container for background canvas and UI overlays */}
      <div style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1,
        pointerEvents: "none"
      }}>
        {/* Set pointerEvents auto so Canvas controls and DOM overlays are clickable */}
        <div style={{ width: "100%", height: "100%", position: "relative", pointerEvents: "auto" }}>
          <Canvas
            shadows
            camera={{ position: [-6, 4, 3], fov: 50 }}
            gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.8, outputColorSpace: THREE.SRGBColorSpace }}
          >
            <color attach="background" args={["#1a1a1a"]} />
            <ambientLight intensity={activeScene === 2 ? 0.6 : activeScene === 3 ? 0.5 : 0.4} />
            <directionalLight position={[5, 8, 5]} intensity={activeScene === 2 ? 2.0 : activeScene === 3 ? 1.8 : 1.5}
              castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
            <directionalLight position={[-5, 4, -5]} intensity={activeScene === 2 ? 0.8 : activeScene === 3 ? 0.6 : 0.4} />
            {(activeScene === 2 || activeScene === 3) && <directionalLight position={[0, 10, 0]} intensity={0.6} />}

            <Suspense fallback={null}>
              {activeScene === 1 ? <Scene1Model /> : activeScene === 2 ? <Scene2Model /> : <Scene3Model />}
            </Suspense>

            {activeScene === 2 && <Scene2Animation scene2SmoothedRef={scene2SmoothedRef} />}
            {activeScene === 2 && <AMR10Animation scene2SmoothedRef={scene2SmoothedRef} />}
            {activeScene === 2 && <APT20PickupAnimation scene2SmoothedRef={scene2SmoothedRef} />}

            {activeScene === 1 && (
              <ScrollCamera
                scrollRef={scrollRef}
              />
            )}
            {activeScene === 2 && <Scene2Setup scene2SmoothedRef={scene2SmoothedRef} scene2ScrollRef={scene2ScrollRef} />}
            {activeScene === 3 && !freeCam3 && <Scene3Camera scene3SmoothedRef={scene3SmoothedRef} scene3ScrollRef={scene3ScrollRef} />}
            {activeScene === 3 && !freeCam3 && <Scene3ModelAnimation scene3SmoothedRef={scene3SmoothedRef} />}
            {activeScene === 3 && freeCam3 && <Scene3FreeCam posRef={camPosSpan} targetRef={camTargetSpan} />}

            <FadeController overlayRef={overlayRef} onSwitch={handleSwitch} />
          </Canvas>

          {/* Full-screen black fade overlay */}
          <div ref={overlayRef} style={{
            position: "absolute", inset: 0,
            background: "#000", opacity: 0, pointerEvents: "none",
            transition: "none",
          }} />

          {/* Scene 3 camera controls + live position HUD */}
          {activeScene === 3 && (
            <div style={{ position: "absolute", top: 14, right: 14, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", zIndex: 10 }}>
              <button
                onClick={() => setFreeCam3(f => !f)}
                style={{
                  background: freeCam3 ? "#b08ac8" : "rgba(0,0,0,0.55)",
                  color: "#fff",
                  border: `1px solid ${freeCam3 ? "#b08ac8" : "rgba(255,255,255,0.18)"}`,
                  borderRadius: 4,
                  padding: "5px 14px",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                {freeCam3 ? "STORY CAM" : "FREE CAM"}
              </button>
              {freeCam3 && (
                <div style={{
                  background: "rgba(0,0,0,0.72)",
                  color: "#e0e0e0",
                  fontFamily: "monospace",
                  fontSize: 11,
                  padding: "10px 14px",
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.1)",
                  lineHeight: 2,
                  minWidth: 270,
                }}>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: "0.14em", marginBottom: 4 }}>CAMERA POSITION</div>
                  <div>pos &nbsp;&nbsp;: <span ref={camPosSpan} style={{ color: "#f5c842" }} /></div>
                  <div>target: <span ref={camTargetSpan} style={{ color: "#4ab0d9" }} /></div>
                </div>
              )}
            </div>
          )}

          {/* Progress bar (scene 1 only) */}
          {activeScene === 1 && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.08)", pointerEvents: "none" }}>
              <div ref={progressRef} style={{ height: "100%", width: "0%", background: "#b08ac8" }} />
            </div>
          )}

          <div style={{
            position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.4)", fontFamily: "system-ui, sans-serif",
            fontSize: 12, letterSpacing: "0.1em", pointerEvents: "none", userSelect: "none",
          }}>
            {activeScene === 1 ? "↕ SCROLL TO ZOOM" : activeScene === 2 ? "VIRYA WAREHOUSE — SCROLL TO EXPLORE" : "VIRYA SCENE 2 — SCROLL UP TO RETURN"}
          </div>
        </div>
      </div>

      {/* Invisible scrollable ghost spacer to define the page height */}
      <div style={{ height: "1200vh", width: "100%", pointerEvents: "none" }} />
    </div>
  );
}
