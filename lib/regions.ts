import type { BodySystem } from "./types";

// Region hotspot map in SVG coordinate space of the TwinFigure viewBox (0 0 400 720).
// Each rule also carries an FMA (Foundational Model of Anatomy) code so the finding
// can be anchored to a real anatomical structure on the twin. FMA codes are what
// the platform's inspector endpoint (/provider/twins/:id/inspector/:fmaCode/snapshot)
// is keyed on.

export interface RegionHit {
  x: number;
  y: number;
  label: string;
  fmaCode: string;
}

interface RegionRule {
  system: BodySystem;
  test: RegExp;
  x: number;
  y: number;
  label: string;
  fmaCode: string;
}

// A curated subset of FMA codes; enough to cover the demo's finding vocabulary.
// Reference: FMA is a standard ontology of human anatomy; codes are stable ids.
const RULES: RegionRule[] = [
  // Neurological
  { system: "neurological", test: /right\s*(basal\s*ganglia)/i, x: 218, y: 70, label: "right basal ganglia", fmaCode: "FMA:61841" },
  { system: "neurological", test: /left\s*(basal\s*ganglia)/i, x: 182, y: 70, label: "left basal ganglia", fmaCode: "FMA:61842" },
  { system: "neurological", test: /right\s*(hemisph|front|parietal|cereb)/i, x: 218, y: 70, label: "right cerebral hemisphere", fmaCode: "FMA:61817" },
  { system: "neurological", test: /left\s*(hemisph|front|parietal|cereb)/i, x: 182, y: 70, label: "left cerebral hemisphere", fmaCode: "FMA:61818" },
  { system: "neurological", test: /midline|centr/i, x: 200, y: 68, label: "midbrain", fmaCode: "FMA:61993" },
  { system: "neurological", test: /.*/, x: 200, y: 68, label: "brain", fmaCode: "FMA:50801" },

  // Respiratory (lungs)
  { system: "respiratory", test: /right\s*upper\s*lobe|right\s*apex/i, x: 158, y: 210, label: "right upper lobe", fmaCode: "FMA:7311" },
  { system: "respiratory", test: /right\s*middle\s*lobe/i, x: 168, y: 258, label: "right middle lobe", fmaCode: "FMA:7312" },
  { system: "respiratory", test: /right\s*lower\s*lobe|right\s*base/i, x: 158, y: 300, label: "right lower lobe", fmaCode: "FMA:7313" },
  { system: "respiratory", test: /right\s*hilum/i, x: 176, y: 258, label: "right lung root", fmaCode: "FMA:14324" },
  { system: "respiratory", test: /left\s*upper\s*lobe|left\s*apex/i, x: 242, y: 210, label: "left upper lobe", fmaCode: "FMA:7314" },
  { system: "respiratory", test: /left\s*lower\s*lobe|left\s*base/i, x: 242, y: 300, label: "left lower lobe", fmaCode: "FMA:7315" },
  { system: "respiratory", test: /left\s*hilum/i, x: 224, y: 258, label: "left lung root", fmaCode: "FMA:14325" },
  { system: "respiratory", test: /bilateral|perihilar/i, x: 200, y: 260, label: "bilateral lungs", fmaCode: "FMA:7196" },
  { system: "respiratory", test: /trache/i, x: 200, y: 180, label: "trachea", fmaCode: "FMA:7394" },
  { system: "respiratory", test: /.*/, x: 200, y: 250, label: "lungs", fmaCode: "FMA:7196" },

  // Cardiovascular
  { system: "cardiovascular", test: /aortic\s*arch|arch/i, x: 208, y: 218, label: "aortic arch", fmaCode: "FMA:3768" },
  { system: "cardiovascular", test: /aort/i, x: 204, y: 226, label: "aorta", fmaCode: "FMA:3734" },
  { system: "cardiovascular", test: /mediastin/i, x: 200, y: 240, label: "mediastinum", fmaCode: "FMA:9826" },
  { system: "cardiovascular", test: /cardiac|silhouette|heart|cardiomeg/i, x: 190, y: 275, label: "heart", fmaCode: "FMA:7088" },
  { system: "cardiovascular", test: /pericard/i, x: 190, y: 275, label: "pericardium", fmaCode: "FMA:9869" },
  { system: "cardiovascular", test: /.*/, x: 190, y: 275, label: "heart", fmaCode: "FMA:7088" },

  // Skeletal
  { system: "skeletal", test: /distal\s*radius.*right|right.*wrist/i, x: 96, y: 400, label: "right radius", fmaCode: "FMA:23463" },
  { system: "skeletal", test: /distal\s*radius|left.*wrist|left.*radius|radius/i, x: 304, y: 400, label: "left radius", fmaCode: "FMA:23464" },
  { system: "skeletal", test: /humer.*right|right.*shoulder|right.*humer/i, x: 118, y: 250, label: "right humerus", fmaCode: "FMA:13303" },
  { system: "skeletal", test: /humer/i, x: 282, y: 250, label: "left humerus", fmaCode: "FMA:13304" },
  { system: "skeletal", test: /rib/i, x: 176, y: 280, label: "ribs", fmaCode: "FMA:7480" },
  { system: "skeletal", test: /femur.*right|right.*thigh|right.*femur/i, x: 178, y: 470, label: "right femur", fmaCode: "FMA:9611" },
  { system: "skeletal", test: /femur/i, x: 222, y: 470, label: "left femur", fmaCode: "FMA:9612" },
  { system: "skeletal", test: /tibia.*right|right.*tibia|right.*shin/i, x: 178, y: 590, label: "right tibia", fmaCode: "FMA:24476" },
  { system: "skeletal", test: /tibia|shin/i, x: 222, y: 590, label: "left tibia", fmaCode: "FMA:24477" },
  { system: "skeletal", test: /pelv|hip/i, x: 200, y: 420, label: "pelvis", fmaCode: "FMA:9578" },
  { system: "skeletal", test: /clav/i, x: 176, y: 168, label: "clavicle", fmaCode: "FMA:13321" },
  { system: "skeletal", test: /vert|spine/i, x: 200, y: 260, label: "spine", fmaCode: "FMA:13478" },
  { system: "skeletal", test: /.*/, x: 200, y: 470, label: "skeleton", fmaCode: "FMA:23881" },
];

const DEFAULTS: Record<BodySystem, RegionHit> = {
  respiratory: { x: 200, y: 250, label: "lungs", fmaCode: "FMA:7196" },
  cardiovascular: { x: 200, y: 275, label: "heart", fmaCode: "FMA:7088" },
  skeletal: { x: 200, y: 470, label: "skeleton", fmaCode: "FMA:23881" },
  neurological: { x: 200, y: 70, label: "brain", fmaCode: "FMA:50801" },
};

export function resolveRegion(system: BodySystem, region: string): RegionHit {
  for (const r of RULES) {
    if (r.system === system && r.test.test(region)) {
      return { x: r.x, y: r.y, label: r.label, fmaCode: r.fmaCode };
    }
  }
  return DEFAULTS[system];
}

// Project SVG viewbox (0..400, 0..720) coords onto a rough normalized 3D body
// space (x: -0.5..0.5 left→right, y: 0..1 head→feet, z: 0 anterior surface).
// Sent as `bodyCoord` on the flag event so the platform sees a 3D anchor,
// not just a category.
export function toBodyCoord(x: number, y: number): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: Math.round(((x - 200) / 400) * 1000) / 1000,
    y: Math.round((y / 720) * 1000) / 1000,
    z: 0,
  };
}

export function systemColorVar(system: BodySystem): string {
  switch (system) {
    case "respiratory":
      return "var(--accent)";
    case "cardiovascular":
      return "var(--accent-2)";
    case "skeletal":
      return "var(--ink-2)";
    case "neurological":
      return "var(--accent)";
  }
}

export function systemLabel(system: BodySystem): string {
  return system.charAt(0).toUpperCase() + system.slice(1);
}
