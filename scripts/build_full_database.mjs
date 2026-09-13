import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPARQL_QUERY = `
SELECT DISTINCT ?os ?osLabel ?basedOn ?basedOnLabel ?family ?familyLabel ?inception ?developerLabel ?licenseLabel ?desc ?article WHERE {
  ?os wdt:P31/wdt:P279* wd:Q9135 .
  OPTIONAL { ?os wdt:P144 ?basedOn . }
  OPTIONAL { ?os wdt:P306 ?family . }
  OPTIONAL { ?os wdt:P571 ?inception . }
  OPTIONAL { ?os wdt:P178 ?developer . }
  OPTIONAL { ?os wdt:P275 ?license . }
  OPTIONAL {
    ?article schema:about ?os ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }
  OPTIONAL {
    ?os schema:description ?desc .
    FILTER(LANG(?desc) = 'en')
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language 'en'. }
}
`;

function inferFamily(name, desc, familyLabel) {
  const text = `${name} ${desc} ${familyLabel}`.toLowerCase();
  if (text.includes('linux') || text.includes('gnu/linux') || text.includes('android')) {
    return 'linux';
  }
  if (text.includes('bsd') || text.includes('berkeley software distribution')) {
    return 'bsd';
  }
  if (
    text.includes('windows') ||
    text.includes('ms-dos') ||
    text.includes('pc dos') ||
    text.includes('microsoft dos')
  ) {
    return 'windows';
  }
  if (
    text.includes('macos') ||
    text.includes('mac os') ||
    text.includes('darwin') ||
    text.includes('nextstep') ||
    text.includes('apple')
  ) {
    return 'apple';
  }
  if (
    text.includes('unix') ||
    text.includes('solaris') ||
    text.includes('sunos') ||
    text.includes('aix') ||
    text.includes('irix') ||
    text.includes('hp-ux') ||
    text.includes('xenix')
  ) {
    return 'unix';
  }
  return 'independent';
}

function inferKernelType(name, desc) {
  const text = `${name} ${desc}`.toLowerCase();
  if (text.includes('microkernel') || text.includes('mach') || text.includes('l4')) {
    return 'microkernel';
  }
  if (text.includes('hybrid')) {
    return 'hybrid';
  }
  if (text.includes('nanokernel')) {
    return 'nanokernel';
  }
  if (text.includes('exokernel')) {
    return 'exokernel';
  }
  if (text.includes('dos') || text.includes('bios') || text.includes('rom')) {
    return 'simple';
  }
  return 'monolithic';
}

function inferYear(inceptionStr) {
  if (!inceptionStr) return null;
  const match = inceptionStr.match(/^(\d{4})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return year >= 1950 && year <= 2026 ? year : null;
}

function extractWikiTitle(articleUrl, name) {
  if (articleUrl) {
    const slug = articleUrl.split('/wiki/').pop();
    if (slug) return decodeURIComponent(slug);
  }
  return name.replace(/\s+/g, '_');
}

async function buildFullDatabase() {
  console.log('Querying Wikidata for all operating systems...');
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', SPARQL_QUERY);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'OSGraphGlobalExtractor/2.0 (https://github.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const bindings = payload.results?.bindings || [];
  console.log(`Fetched ${bindings.length} raw records from Wikidata.`);

  const curatedPath = path.resolve(__dirname, '../src/data/operatingSystems.json');
  const curatedRaw = await fs.readFile(curatedPath, 'utf-8');
  const curatedData = JSON.parse(curatedRaw);

  const curatedNodeMap = new Map();
  curatedData.nodes.forEach((node) => {
    curatedNodeMap.set(node.id, node);
    if (node.wikidataId) {
      curatedNodeMap.set(node.wikidataId, node);
    }
  });

  const nodeMap = new Map();
  const qidToId = new Map();
  const rawLinks = [];

  curatedData.nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node });
    if (node.wikidataId) {
      qidToId.set(node.wikidataId, node.id);
    }
  });

  curatedData.links.forEach((link) => {
    rawLinks.push({ ...link });
  });

  bindings.forEach((item) => {
    const qid = item.os?.value?.split('/').pop();
    if (!qid) return;

    let rawName = item.osLabel?.value || '';
    if (!rawName || /^Q\d+$/.test(rawName)) {
      if (item.article?.value) {
        rawName = decodeURIComponent(item.article.value.split('/wiki/').pop() || '').replace(/_/g, ' ');
      }
    }
    if (!rawName || /^Q\d+$/.test(rawName)) return;

    const existingId = qidToId.get(qid);
    let targetId = existingId;

    if (!targetId) {
      targetId = rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (!targetId) targetId = qid.toLowerCase();
      if (nodeMap.has(targetId)) {
        targetId = `${targetId}-${qid.toLowerCase()}`;
      }
      qidToId.set(qid, targetId);
    }

    const desc = item.desc?.value || '';
    const familyLabel = item.familyLabel?.value || '';
    const inceptionYear = inferYear(item.inception?.value) || 2000;
    const developer = item.developerLabel?.value && !/^Q\d+$/.test(item.developerLabel.value)
      ? item.developerLabel.value
      : 'Open Source Community / Independent';
    const license = item.licenseLabel?.value && !/^Q\d+$/.test(item.licenseLabel.value)
      ? item.licenseLabel.value
      : 'Open Source / Proprietary';
    const family = inferFamily(rawName, desc, familyLabel);
    const kernelType = inferKernelType(rawName, desc);
    const wikiTitle = extractWikiTitle(item.article?.value, rawName);

    if (!nodeMap.has(targetId)) {
      nodeMap.set(targetId, {
        id: targetId,
        name: rawName,
        family,
        kernelType,
        kernelName: `${rawName} Kernel`,
        inceptionYear,
        developer,
        license,
        status: 'active',
        architectures: ['x86-64'],
        wikipediaTitle: wikiTitle,
        wikidataId: qid,
        description: desc,
        significance: 1,
      });
    }

    if (item.basedOn?.value) {
      const parentQid = item.basedOn.value.split('/').pop();
      rawLinks.push({
        sourceQid: parentQid,
        targetId,
        relationType: 'based_on',
      });
    }
  });

  const finalNodes = Array.from(nodeMap.values());
  const finalNodeIds = new Set(finalNodes.map((n) => n.id));

  const validLinks = [];
  const linkKeySet = new Set();

  rawLinks.forEach((link) => {
    let sourceId = link.source || qidToId.get(link.sourceQid);
    let targetId = link.target || link.targetId;

    if (sourceId && targetId && sourceId !== targetId) {
      if (finalNodeIds.has(sourceId) && finalNodeIds.has(targetId)) {
        const key = `${sourceId}->${targetId}`;
        if (!linkKeySet.has(key)) {
          linkKeySet.add(key);
          validLinks.push({
            source: sourceId,
            target: targetId,
            relationType: link.relationType || 'based_on',
          });
        }
      }
    }
  });

  const connectedTargets = new Set(validLinks.map((l) => l.target));
  const connectedSources = new Set(validLinks.map((l) => l.source));

  finalNodes.forEach((node) => {
    if (node.significance >= 4) return;
    if (connectedTargets.has(node.id) || connectedSources.has(node.id)) return;

    let parentId = null;
    const text = `${node.name} ${node.description || ''}`.toLowerCase();

    if (text.includes('debian')) parentId = 'debian';
    else if (text.includes('ubuntu')) parentId = 'ubuntu';
    else if (text.includes('red hat') || text.includes('fedora') || text.includes('rhel')) parentId = 'fedora';
    else if (text.includes('arch')) parentId = 'arch-linux';
    else if (text.includes('gentoo')) parentId = 'gentoo';
    else if (text.includes('slackware')) parentId = 'slackware';
    else if (text.includes('freebsd')) parentId = 'freebsd';
    else if (text.includes('openbsd')) parentId = 'openbsd';
    else if (text.includes('netbsd')) parentId = 'netbsd';
    else if (node.family === 'bsd') parentId = 'bsd-44-lite';
    else if (node.family === 'linux') parentId = 'linux-kernel';
    else if (node.family === 'windows') parentId = 'win-nt-40';
    else if (node.family === 'apple') parentId = 'darwin';
    else if (node.family === 'unix') parentId = 'unix-system-v';
    else if (text.includes('amiga')) parentId = 'amigaos';
    else if (text.includes('solaris')) parentId = 'solaris';

    if (parentId && finalNodeIds.has(parentId) && parentId !== node.id) {
      const key = `${parentId}->${node.id}`;
      if (!linkKeySet.has(key)) {
        linkKeySet.add(key);
        validLinks.push({
          source: parentId,
          target: node.id,
          relationType: 'based_on',
        });
      }
    }
  });

  const derivativeCounts = new Map();
  validLinks.forEach((l) => {
    const src = l.source;
    derivativeCounts.set(src, (derivativeCounts.get(src) || 0) + 1);
  });

  finalNodes.forEach((node) => {
    const count = derivativeCounts.get(node.id) || 0;
    if (node.significance <= 2) {
      if (count > 25) node.significance = 5;
      else if (count > 10) node.significance = 4;
      else if (count > 3) node.significance = 3;
      else if (count > 0) node.significance = 2;
    }
  });

  const outputPayload = {
    nodes: finalNodes,
    links: validLinks,
  };

  const outputPath = path.resolve(__dirname, '../src/data/operatingSystemsFull.json');
  await fs.writeFile(outputPath, JSON.stringify(outputPayload, null, 2), 'utf-8');

  console.log(
    `Successfully built full database: ${finalNodes.length} nodes, ${validLinks.length} lineage links!`
  );
}

buildFullDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
