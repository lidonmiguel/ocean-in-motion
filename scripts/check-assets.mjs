import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { log } from 'node:console';

const html = readFileSync('dist/index.html', 'utf8');
const entryName = basename(html.match(/<script[^>]+src="([^"]+)"/)[1]);
const entry = readFileSync(`dist/assets/${entryName}`);
const compressed = gzipSync(entry, { level: 9 }).length;
assert(entry.length <= 800_000, 'Initial JavaScript exceeds the 800 KB budget');
assert(
  compressed <= 160_000,
  'Initial JavaScript exceeds the 160 KB gzip budget'
);

const files = readdirSync('dist/assets');
for (const [stem, extension] of [
  ['seaAreas', '.geojson'],
  ['caspian', '.geojson'],
  ['temperatureLand', '.geojson'],
  ['temperatureRoutes', '.json']
]) {
  const name = files.find(
    (file) => file.startsWith(stem + '-') && file.endsWith(extension)
  );
  assert(name, `${stem} must be emitted as an independent asset`);
  assert.deepEqual(
    readFileSync(`dist/assets/${name}`),
    readFileSync(`src/data/${stem}${extension}`),
    `${stem} data changed during the build`
  );
}
assert(
  !html.includes('SeaTemperatureMap-') &&
    !html.includes('TemperatureComparison-'),
  'Deferred sections must not be preloaded in the HTML'
);
log(
  `Asset checks passed: initial JS ${entry.length} bytes; gzip ${compressed} bytes; four unchanged independent data assets.`
);
