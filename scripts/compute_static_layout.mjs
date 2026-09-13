import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function positionNodes(dataset) {
  const nodes = dataset.nodes;
  const nodeMap = new Map();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const familyGroups = {
    unix: [],
    apple: [],
    bsd: [],
    windows: [],
    independent: [],
    linux_debian: [],
    linux_redhat: [],
    linux_arch: [],
    linux_gentoo: [],
    linux_other: [],
  };

  nodes.forEach((node) => {
    if (node.family !== 'linux') {
      familyGroups[node.family]?.push(node);
      return;
    }

    const text = `${node.id} ${node.name} ${node.description || ''}`.toLowerCase();
    if (text.includes('debian') || text.includes('ubuntu') || text.includes('mint') || text.includes('kali') || text.includes('pop')) {
      familyGroups.linux_debian.push(node);
    } else if (text.includes('red hat') || text.includes('fedora') || text.includes('rhel') || text.includes('centos') || text.includes('suse') || text.includes('mandriva') || text.includes('mageia')) {
      familyGroups.linux_redhat.push(node);
    } else if (text.includes('arch') || text.includes('manjaro') || text.includes('endeavour') || text.includes('void') || text.includes('artix')) {
      familyGroups.linux_arch.push(node);
    } else if (text.includes('gentoo') || text.includes('slackware') || text.includes('alpine') || text.includes('chromeos')) {
      familyGroups.linux_gentoo.push(node);
    } else {
      familyGroups.linux_other.push(node);
    }
  });

  const sectorConfigs = {
    unix: { cx: 0, cy: -1200, spread: 340 },
    apple: { cx: -1700, cy: -800, spread: 420 },
    bsd: { cx: 1700, cy: -800, spread: 420 },
    windows: { cx: -1700, cy: 900, spread: 460 },
    independent: { cx: 0, cy: 1600, spread: 420 },
    linux_debian: { cx: 1200, cy: 500, spread: 380 },
    linux_redhat: { cx: 2200, cy: 500, spread: 380 },
    linux_arch: { cx: 1200, cy: 1300, spread: 340 },
    linux_gentoo: { cx: 2200, cy: 1300, spread: 340 },
    linux_other: { cx: 1700, cy: 1900, spread: 520 },
  };

  const landmarkAnchors = {
    multics: { x: 0, y: -1400 },
    unix: { x: 0, y: -1250 },
    'unix-system-iii': { x: -90, y: -1100 },
    'unix-system-v': { x: 0, y: -1000 },
    solaris: { x: 90, y: -890 },
    illumos: { x: 160, y: -790 },
    aix: { x: -160, y: -940 },
    'hp-ux': { x: -70, y: -890 },
    irix: { x: 0, y: -840 },
    xenix: { x: -250, y: -1000 },

    'apple-dos': { x: -1900, y: -1050 },
    'classic-mac-os': { x: -1800, y: -930 },
    'system-7': { x: -1860, y: -820 },
    'mac-os-9': { x: -1920, y: -700 },
    mach: { x: -1550, y: -1020 },
    nextstep: { x: -1580, y: -890 },
    openstep: { x: -1640, y: -790 },
    darwin: { x: -1500, y: -720 },
    'mac-os-x-cheetah': { x: -1440, y: -630 },
    'macos-sonoma': { x: -1400, y: -540 },

    'bsd-1': { x: 1550, y: -1020 },
    'bsd-42': { x: 1640, y: -930 },
    'bsd-44-lite': { x: 1720, y: -840 },
    freebsd: { x: 1860, y: -740 },
    netbsd: { x: 1640, y: -720 },
    openbsd: { x: 1540, y: -650 },
    dragonflybsd: { x: 1960, y: -650 },

    'cp-m': { x: -1950, y: 650 },
    qdos: { x: -1850, y: 730 },
    'ms-dos': { x: -1750, y: 800 },
    'win-1': { x: -1640, y: 740 },
    'win-3': { x: -1560, y: 800 },
    'win-95': { x: -1490, y: 880 },
    'win-98': { x: -1420, y: 960 },
    vms: { x: -1950, y: 980 },
    'win-nt-31': { x: -1820, y: 980 },
    'win-nt-40': { x: -1700, y: 1030 },
    'win-2000': { x: -1600, y: 1100 },
    'win-xp': { x: -1500, y: 1180 },
    'win-7': { x: -1400, y: 1250 },
    'win-10': { x: -1300, y: 1320 },
    'win-11': { x: -1220, y: 1390 },

    'linux-kernel': { x: 1700, y: 300 },
    debian: { x: 1100, y: 440 },
    ubuntu: { x: 1050, y: 580 },
    'linux-mint': { x: 980, y: 700 },
    'red-hat-linux': { x: 2150, y: 380 },
    rhel: { x: 2280, y: 480 },
    fedora: { x: 2100, y: 540 },
    'arch-linux': { x: 1150, y: 1220 },
    manjaro: { x: 1080, y: 1340 },
    gentoo: { x: 2180, y: 1220 },
    slackware: { x: 2320, y: 1140 },

    plan9: { x: -180, y: 1480 },
    amigaos: { x: -300, y: 1600 },
    qnx: { x: 180, y: 1480 },
    beos: { x: 280, y: 1600 },
    haiku: { x: 340, y: 1700 },
    redox: { x: 0, y: 1720 },
    templeos: { x: -120, y: 1820 },
  };

  Object.entries(familyGroups).forEach(([groupKey, groupNodes]) => {
    const config = sectorConfigs[groupKey];
    if (!config) return;

    const unanchored = groupNodes.filter((n) => !landmarkAnchors[n.id]);
    unanchored.sort((a, b) => b.significance - a.significance || a.inceptionYear - b.inceptionYear);

    unanchored.forEach((node, idx) => {
      const radius = 45 + Math.sqrt(idx + 1) * (config.spread / Math.sqrt(unanchored.length + 1) * 2.1);
      const angle = idx * GOLDEN_ANGLE;

      const x = Math.round(config.cx + Math.cos(angle) * radius);
      const y = Math.round(config.cy + Math.sin(angle) * radius);

      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    });
  });

  Object.entries(landmarkAnchors).forEach(([id, coords]) => {
    const node = nodeMap.get(id);
    if (node) {
      node.x = coords.x;
      node.y = coords.y;
      node.fx = coords.x;
      node.fy = coords.y;
    }
  });

  for (let iter = 0; iter < 45; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 32) {
          moved = true;
          const overlap = (32 - (dist || 0.1)) / 2;
          const angle = dist > 0.001 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
          const shiftX = Math.cos(angle) * overlap;
          const shiftY = Math.sin(angle) * overlap;

          a.x = Math.round(a.x - shiftX);
          a.y = Math.round(a.y - shiftY);
          a.fx = a.x;
          a.fy = a.y;

          b.x = Math.round(b.x + shiftX);
          b.y = Math.round(b.y + shiftY);
          b.fx = b.x;
          b.fy = b.y;
        }
      }
    }
    if (!moved) break;
  }

  return dataset;
}

async function run() {
  const curatedFile = path.resolve(__dirname, '../src/data/operatingSystems.json');
  const fullFile = path.resolve(__dirname, '../src/data/operatingSystemsFull.json');

  const curated = JSON.parse(await fs.readFile(curatedFile, 'utf-8'));
  const updatedCurated = positionNodes(curated);
  await fs.writeFile(curatedFile, JSON.stringify(updatedCurated, null, 2), 'utf-8');

  const full = JSON.parse(await fs.readFile(fullFile, 'utf-8'));
  const updatedFull = positionNodes(full);
  await fs.writeFile(fullFile, JSON.stringify(updatedFull, null, 2), 'utf-8');

  console.log('Successfully positioned spatial islands with strict separation and 32px clearance!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
