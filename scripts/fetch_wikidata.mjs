import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPARQL_QUERY = `
SELECT DISTINCT ?os ?osLabel ?basedOn ?basedOnLabel ?inception ?developerLabel ?licenseLabel WHERE {
  ?os wdt:P31/wdt:P279* wd:Q9135 .
  OPTIONAL { ?os wdt:P144 ?basedOn . }
  OPTIONAL { ?os wdt:P571 ?inception . }
  OPTIONAL { ?os wdt:P178 ?developer . }
  OPTIONAL { ?os wdt:P275 ?license . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 300
`;

async function fetchWikidataOperatingSystems() {
  const url = new URL('https://query.wikidata.org/sparql');
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', SPARQL_QUERY);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': 'OSGraphLineageBot/1.0 (https://github.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL HTTP error: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const bindings = payload.results?.bindings || [];

  const extracted = bindings.map((item) => ({
    wikidataId: item.os?.value?.split('/').pop() || '',
    name: item.osLabel?.value || '',
    basedOnWikidataId: item.basedOn?.value?.split('/').pop() || null,
    basedOnName: item.basedOnLabel?.value || null,
    inception: item.inception?.value || null,
    developer: item.developerLabel?.value || null,
    license: item.licenseLabel?.value || null,
  }));

  const outputPath = path.resolve(__dirname, '../src/data/wikidata_raw.json');
  await fs.writeFile(outputPath, JSON.stringify(extracted, null, 2), 'utf-8');
  console.log(`Successfully fetched ${extracted.length} records to ${outputPath}`);
}

fetchWikidataOperatingSystems().catch((err) => {
  console.error(err);
  process.exit(1);
});
