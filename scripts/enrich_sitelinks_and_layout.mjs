import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECTOR_CONFIG = {
  unix: {
    center: { x: 0, y: -2200 },
    branches: 3,
    r0: 120,
    spacing: 70,
  },
  apple: {
    center: { x: -3200, y: -1100 },
    branches: 3,
    r0: 120,
    spacing: 70,
  },
  bsd: {
    center: { x: 3200, y: -1100 },
    branches: 3,
    r0: 120,
    spacing: 70,
  },
  windows: {
    center: { x: -3200, y: 1500 },
    branches: 3,
    r0: 120,
    spacing: 70,
  },
  linux: {
    center: { x: 3200, y: 1500 },
    branches: 5,
    r0: 140,
    spacing: 65,
  },
  independent: {
    center: { x: 0, y: 2600 },
    branches: 5,
    r0: 140,
    spacing: 65,
  },
};

async function fetchSitelinksMap(qids) {
  const values = qids.map((q) => 'wd:' + q).join(' ');
  const query = `SELECT ?os ?sitelinks WHERE { VALUES ?os { ${values} } ?os wikibase:sitelinks ?sitelinks . }`;

  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'OSGraphEnricher/1.0',
      Accept: 'application/sparql-results+json',
    },
    body: 'query=' + encodeURIComponent(query),
  });

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const map = new Map();
  data.results?.bindings?.forEach((b) => {
    const q = b.os.value.split('/').pop();
    const count = parseInt(b.sitelinks.value, 10);
    map.set(q, count);
  });
  return map;
}

function assignBranch(node, family, branchesCount) {
  const name = (node.name + ' ' + (node.description || '')).toLowerCase();
  if (family === 'linux') {
    if (name.includes('debian') || name.includes('ubuntu') || name.includes('mint') || name.includes('kali') || name.includes('tails') || name.includes('pop!_os') || name.includes('raspbian')) return 0;
    if (name.includes('red hat') || name.includes('fedora') || name.includes('centos') || name.includes('rocky') || name.includes('alma') || name.includes('rhel')) return 1;
    if (name.includes('slackware') || name.includes('suse') || name.includes('opensuse') || name.includes('mandriva') || name.includes('mageia')) return 2;
    if (name.includes('arch') || name.includes('manjaro') || name.includes('gentoo') || name.includes('alpine') || name.includes('void') || name.includes('nixos')) return 3;
    return 4;
  }
  if (family === 'windows') {
    if (name.includes('dos') || name.includes('windows 1') || name.includes('windows 2') || name.includes('windows 3') || name.includes('windows 95') || name.includes('windows 98') || name.includes('windows me')) return 0;
    if (name.includes('nt') || name.includes('2000') || name.includes('xp') || name.includes('vista') || name.includes('windows 7') || name.includes('windows 8') || name.includes('windows 10') || name.includes('windows 11')) return 1;
    return 2;
  }
  if (family === 'apple') {
    if (name.includes('lisa') || name.includes('system') || name.includes('mac os 7') || name.includes('mac os 8') || name.includes('mac os 9') || name.includes('classic')) return 0;
    if (name.includes('nextstep') || name.includes('darwin') || name.includes('os x') || name.includes('macos')) return 1;
    return 2;
  }
  if (family === 'bsd') {
    if (name.includes('freebsd') || name.includes('ghostbsd') || name.includes('trueos') || name.includes('pc-bsd')) return 0;
    if (name.includes('openbsd')) return 1;
    return 2;
  }
  if (family === 'unix') {
    if (name.includes('bell') || name.includes('research unix') || name.includes('system v') || name.includes('solaris') || name.includes('sunos')) return 0;
    if (name.includes('aix') || name.includes('hp-ux') || name.includes('irix') || name.includes('tru64') || name.includes('xenix') || name.includes('sco')) return 1;
    return 2;
  }
  return Math.abs(hashCode(node.id)) % branchesCount;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function layoutCleanSpatialFamily(family, nodes, config) {
  const { center, branches, r0, spacing } = config;

  const rootCandidates = nodes.filter((n) => n.significance === 5 || (n.sitelinks || 0) >= 50);
  rootCandidates.sort((a, b) => a.inceptionYear - b.inceptionYear);
  const rootNode = rootCandidates[0] || nodes[0];

  rootNode.x = center.x;
  rootNode.y = center.y;
  rootNode.fx = center.x;
  rootNode.fy = center.y;

  const remaining = nodes.filter((n) => n.id !== rootNode.id);

  const branchGroups = Array.from({ length: branches }, () => []);
  remaining.forEach((node) => {
    const bIdx = assignBranch(node, family, branches);
    branchGroups[bIdx].push(node);
  });

  branchGroups.forEach((bNodes, bIdx) => {
    bNodes.sort((a, b) => {
      if (b.significance !== a.significance) return b.significance - a.significance;
      if (a.inceptionYear !== b.inceptionYear) return a.inceptionYear - b.inceptionYear;
      return (b.sitelinks || 0) - (a.sitelinks || 0);
    });

    const baseAngle = (bIdx * 2 * Math.PI) / branches;

    bNodes.forEach((node, idx) => {
      const ringIndex = Math.floor(idx / 3);
      const subOffset = (idx % 3 - 1) * 0.14;
      const radius = r0 + ringIndex * spacing;
      const angle = baseAngle + subOffset;

      const x = Math.round(center.x + Math.cos(angle) * radius);
      const y = Math.round(center.y + Math.sin(angle) * radius);

      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    });
  });
}

function resolveCollisions(nodes, minDistance = 54) {
  const nodeCount = nodes.length;
  for (let pass = 0; pass < 25; pass++) {
    let moved = false;
    for (let i = 0; i < nodeCount; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodeCount; j++) {
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

  const fullData = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
  const curatedData = JSON.parse(await fs.readFile(curatedPath, 'utf-8'));

  const allQids = Array.from(
    new Set(
      [...fullData.nodes, ...curatedData.nodes]
        .map((n) => n.wikidataId)
        .filter(Boolean)
    )
  );

  console.log(`Fetching sitelinks for ${allQids.length} Wikidata entities...`);
  const sitelinksMap = await fetchSitelinksMap(allQids);
  console.log(`Received sitelinks for ${sitelinksMap.size} entities.`);

  const CANONICAL_OVERRIDES = {
    'freebsd': 80,
    'openbsd': 60,
    'netbsd': 55,
    'dragonfly-bsd': 35,
    'ghostbsd': 22,
    'red-hat-linux': 53,
    'kali-linux': 42,
    'nixos': 25,
    'beos': 45,
    'haiku': 38,
    'win-11': 85,
    'win-3': 48,
    'nextstep': 42,
    'macos-sonoma': 110,
    'macos-sierra': 110,
    'mac-os-x-snow-leopard': 110,
    'mach': 35,
    'multics': 38,
    'templeos': 32,
    'sunos': 33,
    'mandriva': 45,
    'rocky-linux': 20,
    'almalinux': 20,
    'postmarketos': 22,
    'pop-os': 25,
    'endeavouros': 22,
    'mx-linux': 28,
    'apple-dos': 20,
    'atari-tos': 30,
    'qdos': 35,
    'redox': 24,
    'genode': 18,
    'guix': 22,
    'devuan': 20,
    'backtrack': 30,
  };

  [fullData, curatedData].forEach((dataset) => {
    dataset.nodes.forEach((node) => {
      const qid = node.wikidataId;
      if (CANONICAL_OVERRIDES[node.id]) {
        node.sitelinks = CANONICAL_OVERRIDES[node.id];
      } else if (qid && sitelinksMap.has(qid)) {
        node.sitelinks = sitelinksMap.get(qid);
      } else if (!node.sitelinks) {
        node.sitelinks = Math.max(0, node.significance * 3);
      }

      if (node.significance >= 4) {
        node.sitelinks = Math.max(node.sitelinks || 0, 35);
      } else if (node.significance >= 3) {
        node.sitelinks = Math.max(node.sitelinks || 0, 15);
      }
    });

    const byFamily = {};
    dataset.nodes.forEach((node) => {
      const fam = node.family || 'independent';
      if (!byFamily[fam]) byFamily[fam] = [];
      byFamily[fam].push(node);
    });

    Object.entries(byFamily).forEach(([fam, fNodes]) => {
      const config = SECTOR_CONFIG[fam] || SECTOR_CONFIG.independent;
      layoutCleanSpatialFamily(fam, fNodes, config);
    });

    resolveCollisions(dataset.nodes, 54);
  });

  await fs.writeFile(fullPath, JSON.stringify(fullData, null, 2), 'utf-8');
  console.log(`Wrote enriched and laid-out full dataset (${fullData.nodes.length} nodes).`);

  await fs.writeFile(curatedPath, JSON.stringify(curatedData, null, 2), 'utf-8');
  console.log(`Wrote enriched and laid-out curated dataset (${curatedData.nodes.length} nodes).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
