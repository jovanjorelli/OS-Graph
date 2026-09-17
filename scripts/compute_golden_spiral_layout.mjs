import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const SECTOR_CENTERS = {
  unix: { x: 0, y: -1400, spacing: 44 },
  apple: { x: -1900, y: -1000, spacing: 44 },
  bsd: { x: 1900, y: -1000, spacing: 44 },
  windows: { x: -1900, y: 1100, spacing: 44 },
  linux: { x: 1900, y: 1100, spacing: 38 },
  independent: { x: 0, y: 1900, spacing: 44 },
};

function deduplicateAndEnrich(dataset) {
  const canonicalMap = new Map();
  const idRemap = new Map();

  const sortedNodes = [...dataset.nodes].sort((a, b) => {
    if (b.significance !== a.significance) return b.significance - a.significance;
    const aIsSimpleId = !a.id.includes('-q');
    const bIsSimpleId = !b.id.includes('-q');
    if (aIsSimpleId && !bIsSimpleId) return -1;
    if (!aIsSimpleId && bIsSimpleId) return 1;
    return (b.description?.length || 0) - (a.description?.length || 0);
  });

  const uniqueNodes = [];
  sortedNodes.forEach((node) => {
    const key = node.name.trim().toLowerCase();
    if (canonicalMap.has(key)) {
      const canonical = canonicalMap.get(key);
      idRemap.set(node.id, canonical.id);
    } else {
      canonicalMap.set(key, node);
      idRemap.set(node.id, node.id);
      uniqueNodes.push(node);
    }
  });

  const cleanLinks = [];
  const linkKeySet = new Set();

  dataset.links.forEach((link) => {
    const rawSource = typeof link.source === 'object' ? link.source.id : link.source;
    const rawTarget = typeof link.target === 'object' ? link.target.id : link.target;

    const source = idRemap.get(rawSource) || rawSource;
    const target = idRemap.get(rawTarget) || rawTarget;

    if (source && target && source !== target) {
      const key = `${source}->${target}`;
      if (!linkKeySet.has(key)) {
        linkKeySet.add(key);
        cleanLinks.push({
          source,
          target,
          relationType: link.relationType || 'based_on',
        });
      }
    }
  });

  return { nodes: uniqueNodes, links: cleanLinks };
}

function layoutGoldenSpirals(dataset) {
  const byFamily = {
    unix: [],
    apple: [],
    bsd: [],
    windows: [],
    linux: [],
    independent: [],
  };

  dataset.nodes.forEach((node) => {
    if (byFamily[node.family]) {
      byFamily[node.family].push(node);
    } else {
      byFamily.independent.push(node);
    }
  });

  Object.entries(byFamily).forEach(([family, nodes]) => {
    const center = SECTOR_CENTERS[family];
    if (!center) return;

    nodes.sort((a, b) => {
      if (b.significance !== a.significance) return b.significance - a.significance;
      return a.inceptionYear - b.inceptionYear;
    });

    nodes.forEach((node, idx) => {
      if (idx === 0) {
        node.x = center.x;
        node.y = center.y;
        node.fx = center.x;
        node.fy = center.y;
        return;
      }

      const radius = center.spacing * Math.sqrt(idx);
      const angle = idx * GOLDEN_ANGLE;

      const x = Math.round(center.x + Math.cos(angle) * radius);
      const y = Math.round(center.y + Math.sin(angle) * radius);

      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    });
  });

  return dataset;
}

async function run() {
  const curatedFile = path.resolve(__dirname, '../src/data/operatingSystems.json');
  const fullFile = path.resolve(__dirname, '../src/data/operatingSystemsFull.json');

  const curated = JSON.parse(await fs.readFile(curatedFile, 'utf-8'));
  const dedupCurated = deduplicateAndEnrich(curated);
  const layoutCurated = layoutGoldenSpirals(dedupCurated);
  await fs.writeFile(curatedFile, JSON.stringify(layoutCurated, null, 2), 'utf-8');
  console.log(`Curated layout complete: ${layoutCurated.nodes.length} nodes, ${layoutCurated.links.length} links.`);

  const full = JSON.parse(await fs.readFile(fullFile, 'utf-8'));
  const dedupFull = deduplicateAndEnrich(full);
  const layoutFull = layoutGoldenSpirals(dedupFull);
  await fs.writeFile(fullFile, JSON.stringify(layoutFull, null, 2), 'utf-8');
  console.log(`Full layout complete: ${layoutFull.nodes.length} nodes, ${layoutFull.links.length} links.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
