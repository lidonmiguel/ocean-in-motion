import type { SpeciesDataset } from './data/schema';

type AreaSource = NonNullable<SpeciesDataset['occurrence']>['sources'][number];
const repository = 'https://github.com/lidonmiguel/ocean-in-motion/blob/main';
const total = (counts: Record<string, number>) => Object.values(counts).reduce((sum, count) => sum + count, 0);

const reasons: Record<string, string> = {
  invalidCoordinatesOrOutsideBounds: 'Coordenadas inválidas o fuera de la consulta',
  duplicateIdentifiers: 'Identificadores duplicados',
  no_accepted_name: 'Nombre aceptado diferente',
  obis_on_land: 'Marcado por OBIS como terrestre',
  uncertainty_over_300_km: 'Incertidumbre superior a 300 km'
};

function rightsLabel(value: string) {
  const cc0 = value.match(/creativecommons\.org\/publicdomain\/zero\/(\d+\.\d+)/i);
  if (cc0) return `CC0 ${cc0[1]}`;
  const license = value.match(/creativecommons\.org\/licenses\/(by(?:-nc|-sa|-nd|-nc-sa|-nc-nd)?)\/(\d+\.\d+)/i);
  return license ? `CC ${license[1].toUpperCase()} ${license[2]}` : value;
}

function counted(counts: Record<string, number>, label = (value: string) => value) {
  return Object.entries(counts).map(([value, count]) => `${label(value)}: ${count}`).join(' · ');
}

function coordinateUncertainty(range: [number, number] | null) {
  if (!range) return 'No declarada para los registros de esta caja';
  const [low, high] = range;
  return `${low === high ? low : `${low}–${high}`} km declarados`;
}

export function AreaEvidenceCard({ source }: { source: AreaSource }) {
  const quality = source.scopeQuality;
  const metadata = source.recordMetadata;
  const simplifyRights = (counts: Record<string, number>) => Object.entries(counts).reduce<Record<string, number>>((result, [value, count]) => {
    const label = rightsLabel(value);
    result[label] = (result[label] ?? 0) + count;
    return result;
  }, {});
  const recordRights = simplifyRights(metadata.recordLicenseCounts);
  const boxRights = simplifyRights(source.boxRecordRights.counts);
  const rightsDiffer = metadata.missingRecordLicense > 0
    || Object.keys(recordRights).some(label => label !== source.license);
  const curatedUrl = `${repository}/src/data/curated/${source.speciesId}.json`;
  const manifestUrl = `${repository}/data/obis/${source.extractId}.manifest.json`;
  const rejectedBefore = total(quality.upstreamRejected);
  const rejectedAfter = total(quality.rejectedByReason);
  const [west, south, east, north] = source.queryBoundsWgs84;

  return <section className="area-evidence" aria-label={`Evidencia de ${source.region}`} aria-live="polite">
    <h3>Evidencia de la zona</h3>
    <p className="evidence-region">{source.region}</p>
    <p>Esta caja agrupa <strong>{source.count} registros aceptados</strong> del ámbito <code>{source.scopeId}</code>. Su contorno añade margen visual a las posiciones, no delimita hábitat.</p>
    <dl>
      <dt>Fuente</dt><dd><a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.citation}</a><small>UUID: {source.datasetId}</small></dd>
      <dt>Consulta</dt><dd>{source.query.startDate} a {source.query.endDate}<small>WGS84 · oeste {west}, sur {south}, este {east}, norte {north}</small><small>Acceso: {source.accessedAtUtc.slice(0, 10)}</small></dd>
      <dt>Selección del ámbito</dt><dd>{quality.rawFetched} obtenidos · {quality.staged} preparados · {quality.accepted} aceptados · {rejectedBefore + rejectedAfter} descartados<small>{rejectedBefore} antes y {rejectedAfter} después de la preparación. Estos totales corresponden al ámbito completo, que puede producir varias cajas.</small></dd>
      <dt>Incertidumbre de esta caja</dt><dd>{coordinateUncertainty(source.coordinateUncertaintyKmRange)}<small>{source.unknownCoordinateUncertainty} de {source.count} sin valor declarado. No mide certeza de especie ni error de muestreo.</small></dd>
      <dt>Método registrado</dt><dd>Tipo: {counted(metadata.basisOfRecordCounts)}<small>Protocolo: {counted(metadata.samplingProtocolCounts) || 'no informado'}; sin protocolo: {metadata.missingSamplingProtocol} de {quality.accepted} en el ámbito. La descripción completa del método depende de la fuente enlazada.</small></dd>
      <dt>Derechos</dt><dd>Metadatos del dataset: {source.license}<small>Campo de licencia de esta caja: {counted(boxRights) || 'sin valor'}; ausente: {source.boxRecordRights.missing} de {source.count}.</small><small>Ámbito completo: {counted(recordRights) || 'sin valor'}; ausente: {metadata.missingRecordLicense} de {quality.accepted}.</small><small className="rights-note">{rightsDiffer ? 'Los campos difieren o faltan. Revise cada fuente y sus condiciones antes de reutilizar los registros.' : 'Las etiquetas coinciden; revise las condiciones de la fuente antes de reutilizar los registros.'} No se ofrece descarga.</small></dd>
    </dl>
    {(rejectedBefore + rejectedAfter > 0) && <details><summary>Motivos de descarte del ámbito</summary><p>Antes de preparar: {counted(quality.upstreamRejected, reason => reasons[reason] ?? reason) || 'ninguno'}.</p><p>Después: {counted(quality.rejectedByReason, reason => reasons[reason] ?? reason) || 'ninguno'}.</p></details>}
    <p className="sampling-note">Límite de muestreo: son posiciones notificadas dentro de esta consulta. El esfuerzo, el protocolo y la precisión varían entre fuentes; las zonas vacías no prueban ausencia y el número de registros no mide abundancia.</p>
    <p><a href={curatedUrl} target="_blank" rel="noreferrer">Abrir archivo curado de {source.speciesId}</a> · <a href={manifestUrl} target="_blank" rel="noreferrer">Consulta y recuentos originales</a></p>
    <details><summary>IDs OBIS de esta caja ({source.recordIds.length})</summary><p>Busque estos IDs en <code>observations[]</code> del archivo curado; cada fila conserva <code>scopeId</code>, fecha y coordenadas.</p><div className="evidence-ids">{source.recordIds.map(id => <code key={id}>{id}</code>)}</div></details>
  </section>;
}
