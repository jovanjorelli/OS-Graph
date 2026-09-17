import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFamilyCategory(family, name, kernelType) {
  const n = name.toLowerCase();
  if (family === 'linux') {
    if (n.includes('security') || n.includes('kali') || n.includes('black') || n.includes('parrot')) {
      return 'Security & Penetration Testing Distribution';
    }
    if (n.includes('server') || n.includes('rhel') || n.includes('rocky') || n.includes('almalinux')) {
      return 'Enterprise Server Distribution';
    }
    if (n.includes('embed') || n.includes('rt') || n.includes('busybox') || n.includes('openwrt')) {
      return 'Embedded & Router Linux Distribution';
    }
    return 'Linux Operating System Distribution';
  }
  if (family === 'bsd') {
    return 'Berkeley Software Distribution Derivative';
  }
  if (family === 'windows') {
    if (n.includes('dos')) return 'Disk Operating System (DOS)';
    if (n.includes('server')) return 'Enterprise Windows Server';
    if (n.includes('nt')) return 'Windows NT Architecture';
    return 'Windows Desktop Operating System';
  }
  if (family === 'apple') {
    if (n.includes('next') || n.includes('mach')) return 'Mach / NeXTSTEP Unix Hybrid';
    if (n.includes('classic') || n.includes('system')) return 'Classic Macintosh System';
    return 'Apple macOS / Darwin Architecture';
  }
  if (family === 'unix') {
    return 'Research & Commercial Unix System';
  }
  if (kernelType === 'microkernel') {
    return 'Microkernel Operating System';
  }
  return 'Independent Operating System';
}

function generateEnrichedDescription(node) {
  const category = getFamilyCategory(node.family, node.name, node.kernelType);
  const statusStr = node.status === 'active' ? 'actively maintained' : 'historic';

  return `${node.name} is an ${statusStr} ${category.toLowerCase()} originating in ${node.inceptionYear}. Developed primarily by ${node.developer}, it features a ${node.kernelType} kernel design (${node.kernelName}) targeting ${node.architectures.join(', ')} architectures under ${node.license}.`;
}

function relaxNodePositions(nodes, minDistance = 28, iterations = 40) {
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist < minDistance) {
          moved = true;
          const overlap = (minDistance - (dist || 0.1)) / 2;
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
}

async function auditAndEnrichDataset(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);

  let enrichedCount = 0;
  data.nodes.forEach((node) => {
    if (!node.description || node.description.trim().length < 15) {
      node.description = generateEnrichedDescription(node);
      enrichedCount++;
    }

    if (!node.wikipediaTitle || node.wikipediaTitle.startsWith('Q')) {
      node.wikipediaTitle = node.name.replace(/\s+/g, '_');
    }
  });

  relaxNodePositions(data.nodes, 28, 45);

  let remainingClashes = 0;
  for (let i = 0; i < data.nodes.length; i++) {
    for (let j = i + 1; j < data.nodes.length; j++) {
      const dist = Math.hypot(data.nodes[i].x - data.nodes[j].x, data.nodes[i].y - data.nodes[j].y);
      if (dist < 22) remainingClashes++;
    }
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(
    `Processed ${filePath}: Enriched ${enrichedCount} nodes. Clashes under 22px: ${remainingClashes}`
  );
}

async function main() {
  const curatedPath = path.resolve(__dirname, '../src/data/operatingSystems.json');
  const fullPath = path.resolve(__dirname, '../src/data/operatingSystemsFull.json');

  await auditAndEnrichDataset(curatedPath);
  await auditAndEnrichDataset(fullPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
