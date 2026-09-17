import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECTOR_CENTERS = {
  unix: { x: 0, y: -3900 },
  apple: { x: -3900, y: -1500 },
  bsd: { x: 3900, y: -1500 },
  windows: { x: -3900, y: 2100 },
  linux: { x: 3900, y: 2100 },
  independent: { x: 0, y: 4500 },
};

function generateStarCluster(nodes, center) {
  if (nodes.length === 0) return;
  nodes[0].x = center.x;
  nodes[0].y = center.y;
  nodes[0].fx = center.x;
  nodes[0].fy = center.y;

  const count = nodes.length - 1;
  if (count <= 0) return;

  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
    const r = i % 2 === 0 ? 110 : 185;
    const x = Math.round(center.x + Math.cos(angle) * r);
    const y = Math.round(center.y + Math.sin(angle) * r);
    const targetNode = nodes[i + 1];
    targetNode.x = x;
    targetNode.y = y;
    targetNode.fx = x;
    targetNode.fy = y;
  }
}

function generateCelestialHalos(nodes, center) {
  if (nodes.length === 0) return;
  nodes[0].x = center.x;
  nodes[0].y = center.y;
  nodes[0].fx = center.x;
  nodes[0].fy = center.y;

  const total = nodes.length - 1;
  if (total <= 0) return;

  const minArcSpacing = 85;
  const radialGap = 110;
  const baseRadius = 140;

  let assignedCount = 0;
  let ringIndex = 0;

  while (assignedCount < total) {
    const remaining = total - assignedCount;
    const currentRadius = baseRadius + ringIndex * radialGap;
    const circumference = 2 * Math.PI * currentRadius;
    const ringCapacity = Math.max(6, Math.floor(circumference / minArcSpacing));
    const countInRing = Math.min(remaining, ringCapacity);
    const phaseOffset = ringIndex % 2 === 0 ? 0 : Math.PI / countInRing;

    for (let i = 0; i < countInRing; i++) {
      const angle = (i * 2 * Math.PI) / countInRing + phaseOffset;
      const x = Math.round(center.x + Math.cos(angle) * currentRadius);
      const y = Math.round(center.y + Math.sin(angle) * currentRadius);
      const node = nodes[1 + assignedCount + i];
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    }

    assignedCount += countInRing;
    ringIndex++;
  }
}

function generateGalaxySpiral(nodes, center) {
  if (nodes.length === 0) return;
  nodes[0].x = center.x;
  nodes[0].y = center.y;
  nodes[0].fx = center.x;
  nodes[0].fy = center.y;

  const total = nodes.length - 1;
  if (total <= 0) return;

  const armsCount = total < 8 ? 2 : 3;
  const armNodes = Array.from({ length: armsCount }, () => []);

  for (let i = 0; i < total; i++) {
    armNodes[i % armsCount].push(nodes[1 + i]);
  }

  armNodes.forEach((armList, armIdx) => {
    const armBaseAngle = (armIdx * 2 * Math.PI) / armsCount;
    armList.forEach((node, nodeIdx) => {
      const t = 1.0 + nodeIdx * 0.28;
      const r = 120 + nodeIdx * 45;
      const theta = armBaseAngle + t * 1.6;
      const x = Math.round(center.x + Math.cos(theta) * r);
      const y = Math.round(center.y + Math.sin(theta) * r);
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    });
  });
}

function generateTridentScepter(nodes, center) {
  if (nodes.length === 0) return;
  nodes[0].x = center.x;
  nodes[0].y = center.y;
  nodes[0].fx = center.x;
  nodes[0].fy = center.y;

  const total = nodes.length - 1;
  if (total <= 0) return;

  if (total < 6) {
    generateStarCluster(nodes, center);
    return;
  }

  let stemCount = Math.max(1, Math.min(8, Math.floor(total / 5)));
  let crossbarCount = Math.max(2, Math.min(8, Math.floor(total / 5)));
  if (crossbarCount % 2 !== 0) crossbarCount++;
  let tinesTotal = total - stemCount - crossbarCount;

  if (tinesTotal < 3) {
    stemCount = 1;
    crossbarCount = 2;
    tinesTotal = total - 3;
  }

  let idx = 1;
  for (let i = 0; i < stemCount && idx < nodes.length; i++, idx++) {
    const x = center.x;
    const y = Math.round(center.y + 80 + i * 70);
    nodes[idx].x = x;
    nodes[idx].y = y;
    nodes[idx].fx = x;
    nodes[idx].fy = y;
  }

  const crossbarHalf = crossbarCount / 2;
  const crossbarSpan = total < 15 ? 260 : 380;
  const crossbarStep = crossbarHalf > 1 ? (crossbarSpan - 80) / (crossbarHalf - 1) : 0;

  for (let i = 0; i < crossbarHalf && idx < nodes.length; i++, idx++) {
    const x = Math.round(center.x - 80 - i * crossbarStep);
    const y = center.y;
    nodes[idx].x = x;
    nodes[idx].y = y;
    nodes[idx].fx = x;
    nodes[idx].fy = y;
  }
  for (let i = 0; i < crossbarHalf && idx < nodes.length; i++, idx++) {
    const x = Math.round(center.x + 80 + i * crossbarStep);
    const y = center.y;
    nodes[idx].x = x;
    nodes[idx].y = y;
    nodes[idx].fx = x;
    nodes[idx].fy = y;
  }

  const leftX = -crossbarSpan;
  const centerX = 0;
  const rightX = crossbarSpan;

  for (let i = 0; idx < nodes.length; i++) {
    const y = Math.round(center.y - 80 - i * 70);
    if (idx < nodes.length) {
      nodes[idx].x = center.x + leftX;
      nodes[idx].y = y;
      nodes[idx].fx = nodes[idx].x;
      nodes[idx].fy = y;
      idx++;
    }
    if (idx < nodes.length) {
      nodes[idx].x = center.x + centerX;
      nodes[idx].y = y;
      nodes[idx].fx = nodes[idx].x;
      nodes[idx].fy = y;
      idx++;
    }
    if (idx < nodes.length) {
      nodes[idx].x = center.x + rightX;
      nodes[idx].y = y;
      nodes[idx].fx = nodes[idx].x;
      nodes[idx].fy = y;
      idx++;
    }
  }
}

function generateDiamondMatrix(nodes, center) {
  if (nodes.length === 0) return;
  nodes[0].x = center.x;
  nodes[0].y = center.y;
  nodes[0].fx = center.x;
  nodes[0].fy = center.y;

  const total = nodes.length - 1;
  if (total <= 0) return;

  let assignedCount = 0;
  let ring = 1;

  while (assignedCount < total) {
    const remaining = total - assignedCount;
    const ringCapacity = 4 * ring;
    const countInRing = Math.min(remaining, ringCapacity);
    const r = 120 + (ring - 1) * 90;

    for (let i = 0; i < countInRing; i++) {
      const angle = (i * 2 * Math.PI) / countInRing;
      const diamondFactor = 1 / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));
      const x = Math.round(center.x + Math.cos(angle) * r * diamondFactor * 1.4);
      const y = Math.round(center.y + Math.sin(angle) * r * diamondFactor * 1.4);
      const node = nodes[1 + assignedCount + i];
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    }

    assignedCount += countInRing;
    ring++;
  }
}

function generateSnowflakeMandala(nodes, center) {
  if (nodes.length === 0) return;
  nodes[0].x = center.x;
  nodes[0].y = center.y;
  nodes[0].fx = center.x;
  nodes[0].fy = center.y;

  const total = nodes.length - 1;
  if (total <= 0) return;

  let assignedCount = 0;
  let ring = 1;
  const baseAngle = Math.PI / 6;

  while (assignedCount < total) {
    const remaining = total - assignedCount;
    const ringCapacity = 6 * ring;
    const countInRing = Math.min(remaining, ringCapacity);
    const r = 130 + (ring - 1) * 95;

    for (let i = 0; i < countInRing; i++) {
      const angle = baseAngle + (i * 2 * Math.PI) / countInRing;
      const x = Math.round(center.x + Math.cos(angle) * r);
      const y = Math.round(center.y + Math.sin(angle) * r);
      const node = nodes[1 + assignedCount + i];
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    }

    assignedCount += countInRing;
    ring++;
  }
}

function generateButterflyNebula(nodes, center) {
  if (nodes.length === 0) return;
  nodes[0].x = center.x;
  nodes[0].y = center.y;
  nodes[0].fx = center.x;
  nodes[0].fy = center.y;

  const total = nodes.length - 1;
  if (total <= 0) return;

  let assignedCount = 0;
  let ring = 1;

  while (assignedCount < total) {
    const remaining = total - assignedCount;
    const ringCapacity = 6 * ring;
    const countInRing = Math.min(remaining, ringCapacity);
    const baseR = 120 + (ring - 1) * 88;

    for (let i = 0; i < countInRing; i++) {
      const angle = (i * 2 * Math.PI) / countInRing;
      const lobeFactor = 0.65 + 0.65 * Math.abs(Math.sin(angle));
      const x = Math.round(center.x + Math.cos(angle) * baseR * 1.35);
      const y = Math.round(center.y + Math.sin(angle) * baseR * lobeFactor * 1.15);
      const node = nodes[1 + assignedCount + i];
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    }

    assignedCount += countInRing;
    ring++;
  }
}

const SHAPE_TEMPLATES = {
  snowflake: generateSnowflakeMandala,
  spiral: generateGalaxySpiral,
  trident: generateTridentScepter,
  diamond: generateDiamondMatrix,
  halos: generateCelestialHalos,
  nebula: generateButterflyNebula,
  star: generateStarCluster,
};

function selectAdaptiveShape(family, nodeCount) {
  if (nodeCount <= 4) {
    return SHAPE_TEMPLATES.star;
  }

  switch (family) {
    case 'linux':
      return SHAPE_TEMPLATES.snowflake;
    case 'apple':
      return SHAPE_TEMPLATES.spiral;
    case 'bsd':
      return SHAPE_TEMPLATES.trident;
    case 'windows':
      return SHAPE_TEMPLATES.diamond;
    case 'unix':
      return SHAPE_TEMPLATES.halos;
    case 'independent':
      return SHAPE_TEMPLATES.nebula;
    default:
      if (nodeCount <= 12) return SHAPE_TEMPLATES.star;
      if (nodeCount <= 50) return SHAPE_TEMPLATES.halos;
      if (nodeCount <= 200) return SHAPE_TEMPLATES.diamond;
      return SHAPE_TEMPLATES.snowflake;
  }
}

function applyConstellationLayout(dataset) {
  const byFamily = {
    unix: [],
    apple: [],
    bsd: [],
    windows: [],
    linux: [],
    independent: [],
  };

  dataset.nodes.forEach((n) => {
    if (byFamily[n.family]) byFamily[n.family].push(n);
    else byFamily.independent.push(n);
  });

  Object.values(byFamily).forEach((list) => {
    list.sort((a, b) => {
      if (b.significance !== a.significance) return b.significance - a.significance;
      return a.inceptionYear - b.inceptionYear;
    });
  });

  Object.entries(byFamily).forEach(([family, familyNodes]) => {
    const center = SECTOR_CENTERS[family] || SECTOR_CENTERS.independent;
    const layoutAlgorithm = selectAdaptiveShape(family, familyNodes.length);
    layoutAlgorithm(familyNodes, center);
  });

  return dataset;
}

async function run() {
  const fullFile = path.resolve(__dirname, '../src/data/operatingSystemsFull.json');
  const curatedFile = path.resolve(__dirname, '../src/data/operatingSystems.json');

  const full = JSON.parse(await fs.readFile(fullFile, 'utf-8'));
  applyConstellationLayout(full);
  await fs.writeFile(fullFile, JSON.stringify(full, null, 2), 'utf-8');
  console.log(`Updated operatingSystemsFull.json with ${full.nodes.length} nodes.`);

  const curated = JSON.parse(await fs.readFile(curatedFile, 'utf-8'));
  applyConstellationLayout(curated);
  await fs.writeFile(curatedFile, JSON.stringify(curated, null, 2), 'utf-8');
  console.log(`Updated operatingSystems.json with ${curated.nodes.length} nodes.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
