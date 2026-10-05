import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Controls and exports need names, not the megabytes of polygon coordinates.
const catalogId = 'virtual:sea-region-catalog';
const sources = ['src/data/seaAreas.geojson', 'src/data/caspian.geojson'].map(
  (path) => resolve(path)
);

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sea-region-catalog',
      resolveId(id) {
        if (id === catalogId) return '\0' + catalogId;
      },
      load(id) {
        if (id !== '\0' + catalogId) return;
        const regions = sources.flatMap((path) => {
          this.addWatchFile(path);
          const source = JSON.parse(readFileSync(path, 'utf8'));
          return (source.features ?? [source]).map(
            (feature: { properties: { id: string; name: string } }) =>
              feature.properties
          );
        });
        return `export default ${JSON.stringify(regions)}`;
      }
    }
  ]
});
