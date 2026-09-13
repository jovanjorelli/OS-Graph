import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECTOR_COORDINATES = {
  unix: {
    label: '01 // UNIX ANCESTRAL CORE',
    center: { x: 0, y: -2200 },
    branches: 2,
    r0: 120,
    spacing: 75,
  },
  apple: {
    label: '02 // APPLE & MACH HYBRID',
    center: { x: -3200, y: -1100 },
    branches: 3,
    r0: 120,
    spacing: 75,
  },
  bsd: {
    label: '03 // BSD HERITAGE & STACK',
    center: { x: 3200, y: -1100 },
    branches: 3,
    r0: 120,
    spacing: 75,
  },
  windows: {
    label: '04 // WINDOWS NT & DOS MATRIX',
    center: { x: -3200, y: 1500 },
    branches: 3,
    r0: 120,
    spacing: 75,
  },
  linux: {
    label: '05 // LINUX GALAXY',
    center: { x: 3200, y: 1500 },
    branches: 5,
    r0: 140,
    spacing: 75,
  },
  independent: {
    label: '06 // RESEARCH & MICROKERNELS',
    center: { x: 0, y: 2600 },
    branches: 4,
    r0: 140,
    spacing: 75,
  },
};

function assignBranch(node, family) {
  const text = (node.name + ' ' + (node.description || '')).toLowerCase();
  if (family === 'linux') {
    if (text.includes('debian') || text.includes('ubuntu') || text.includes('mint') || text.includes('kali') || text.includes('tails') || text.includes('pop!_os')) return 0;
    if (text.includes('red hat') || text.includes('fedora') || text.includes('centos') || text.includes('rocky') || text.includes('alma') || text.includes('rhel')) return 1;
    if (text.includes('slackware') || text.includes('suse') || text.includes('opensuse') || text.includes('mandriva') || text.includes('mageia')) return 2;
    if (text.includes('arch') || text.includes('manjaro') || text.includes('gentoo') || text.includes('alpine') || text.includes('void') || text.includes('nixos')) return 3;
    return 4;
  }
  if (family === 'windows') {
    if (text.includes('dos') || text.includes('windows 1') || text.includes('windows 2') || text.includes('windows 3') || text.includes('windows 95') || text.includes('windows 98') || text.includes('windows me')) return 0;
    if (text.includes('nt') || text.includes('2000') || text.includes('xp') || text.includes('vista') || text.includes('windows 7') || text.includes('windows 8') || text.includes('windows 10') || text.includes('windows 11')) return 1;
    return 2;
  }
  if (family === 'apple') {
    if (text.includes('lisa') || text.includes('system') || text.includes('mac os 7') || text.includes('mac os 8') || text.includes('mac os 9') || text.includes('classic')) return 0;
    if (text.includes('nextstep') || text.includes('darwin') || text.includes('os x') || text.includes('macos')) return 1;
    return 2;
  }
  if (family === 'bsd') {
    if (text.includes('freebsd') || text.includes('ghostbsd') || text.includes('trueos') || text.includes('pc-bsd')) return 0;
    if (text.includes('openbsd')) return 1;
    return 2;
  }
  if (family === 'unix') {
    if (text.includes('bell') || text.includes('research unix') || text.includes('system v') || text.includes('solaris') || text.includes('sunos')) return 0;
    return 1;
  }
  if (text.includes('mach') || text.includes('l4') || text.includes('qnx') || text.includes('minix') || text.includes('genode') || text.includes('redox')) return 0;
  if (text.includes('amiga') || text.includes('beos') || text.includes('haiku') || text.includes('os/2') || text.includes('atari')) return 1;
  if (text.includes('cp/m') || text.includes('multics') || text.includes('plan 9') || text.includes('inferno')) return 2;
  return 3;
}

function computeCleanIslandLayout(familyNodes, config) {
  const { center, branches, r0, spacing } = config;

  const rootCandidates = familyNodes.filter((n) => n.significance === 5 || (n.sitelinks || 0) >= 50);
  rootCandidates.sort((a, b) => a.inceptionYear - b.inceptionYear);
  const rootNode = rootCandidates[0] || familyNodes[0];

  rootNode.x = center.x;
  rootNode.y = center.y;
  rootNode.fx = center.x;
  rootNode.fy = center.y;

  const branchBuckets = Array.from({ length: branches }, () => []);
  familyNodes.forEach((node) => {
    if (node.id === rootNode.id) return;
    const bIdx = assignBranch(node, node.family) % branches;
    branchBuckets[bIdx].push(node);
  });

  branchBuckets.forEach((bNodes, bIdx) => {
    bNodes.sort((a, b) => {
      if (a.inceptionYear !== b.inceptionYear) return a.inceptionYear - b.inceptionYear;
      return (b.sitelinks || 0) - (a.sitelinks || 0);
    });

    const baseAngle = (bIdx * 2 * Math.PI) / branches;

    bNodes.forEach((node, step) => {
      const radius = r0 + Math.floor(step / 2) * spacing;
      const angleOffset = (step % 2 === 0 ? 1 : -1) * (0.08 + (step % 4) * 0.04);
      const angle = baseAngle + angleOffset;

      const x = Math.round(center.x + Math.cos(angle) * radius);
      const y = Math.round(center.y + Math.sin(angle) * radius);

      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    });
  });
}

function resolveCollisions(nodes, minDistance = 65) {
  const n = nodes.length;
  for (let pass = 0; pass < 25; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        if (a.family !== b.family) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < minDistance) {
          const overlap = (minDistance - dist) / 2;
          const nx = (dx / dist) * overlap;
          const ny = (dy / dist) * overlap;
          a.x -= nx;
          a.y -= ny;
          a.fx = a.x;
          a.fy = a.y;
          b.x += nx;
          b.y += ny;
          b.fx = b.x;
          b.fy = b.y;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

async function run() {
  const fullPath = path.resolve(__dirname, '../src/data/operatingSystemsFull.json');
  const curatedPath = path.resolve(__dirname, '../src/data/operatingSystems.json');

  const rawFull = JSON.parse(await fs.readFile(fullPath, 'utf-8'));

  const filteredNodes = rawFull.nodes.filter((node) => {
    if (node.significance >= 4) return true;
    return (node.sitelinks || 0) >= 10;
  });

  const nodeMap = new Map(filteredNodes.map((n) => [n.id, n]));

  const filteredLinks = [];
  const linkKeys = new Set();

  rawFull.links.forEach((link) => {
    const sId = typeof link.source === 'object' ? link.source.id : link.source;
    const tId = typeof link.target === 'object' ? link.target.id : link.target;
    if (nodeMap.has(sId) && nodeMap.has(tId) && sId !== tId) {
      const key = `${sId}->${tId}`;
      if (!linkKeys.has(key)) {
        linkKeys.add(key);
        filteredLinks.push({
          source: sId,
          target: tId,
          relationType: link.relationType || 'based_on',
        });
      }
    }
  });

  const byFamily = {};
  filteredNodes.forEach((node) => {
    const fam = node.family || 'independent';
    if (!byFamily[fam]) byFamily[fam] = [];
    byFamily[fam].push(node);
  });

  Object.entries(byFamily).forEach(([fam, fNodes]) => {
    const cfg = SECTOR_COORDINATES[fam] || SECTOR_COORDINATES.independent;
    computeCleanIslandLayout(fNodes, cfg);
  });

  resolveCollisions(filteredNodes, 65);

  const cleanDataset = {
    nodes: filteredNodes,
    links: filteredLinks,
  };

  await fs.writeFile(fullPath, JSON.stringify(cleanDataset, null, 2), 'utf-8');
  console.log(`Successfully built clean popular matrix in operatingSystemsFull.json: ${cleanDataset.nodes.length} nodes, ${cleanDataset.links.length} links.`);

  const curatedNodes = filteredNodes.filter((n) => n.significance >= 3 || n.sitelinks >= 40);
  const curatedMap = new Map(curatedNodes.map((n) => [n.id, n]));
  const curatedLinks = filteredLinks.filter((l) => curatedMap.has(l.source) && curatedMap.has(l.target));

  const cleanCurated = {
    nodes: curatedNodes,
    links: curatedLinks,
  };

  await fs.writeFile(curatedPath, JSON.stringify(cleanCurated, null, 2), 'utf-8');
  console.log(`Successfully built curated milestones dataset in operatingSystems.json: ${cleanCurated.nodes.length} nodes, ${cleanCurated.links.length} links.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
