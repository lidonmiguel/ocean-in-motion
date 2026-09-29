# Pipeline de datos OBIS para el mapa

La web lee **un archivo limpio por especie** en `src/data/curated/*.json`.
Estos diez archivos proceden de 54 extractos OBIS acotados y versionados en
`data/obis/`. La pipeline no calcula destinos ni convierte las simulaciones
visuales actuales en predicciones.

## Flujo y reproducción

1. `sources.py` consulta OBIS con AphiaID, UUID del dataset, límites WGS84,
   fechas y tope explícitos. Guarda JSONL de filas que superan el control de
   coordenadas e identificadores, más un manifiesto con consulta, fecha de
   acceso, huella SHA-256 y contadores de todos los registros consultados.
2. `publish_species.py` y `publish_pilot.py` verifican por ámbito la especie,
   dataset, fechas, posición, estado, banderas y derechos documentados. Se
   excluyen `ON_LAND`, incertidumbre declarada mayor de 300 km y, donde
   corresponda, `NO_ACCEPTED_NAME` con otro AphiaID.
3. `curate.py` reúne los 54 ámbitos en diez archivos con observaciones
   aceptadas, procedencia y contadores. Deja las exclusiones posteriores al
   staging en `data/curated/rejected-records.jsonl` (ámbito, ID OBIS, motivo).
4. `src/data/curated.ts` comprueba la estructura, límites y contadores antes
   de dar los registros a la lógica existente de cajas. El desplazamiento
   ilustrativo se aplica después y no entra en los archivos limpios.

Desde la raíz del repositorio:

```bash
PYTHONPATH=python python -m ocean_pipeline.curate
PYTHONPATH=python python -m ocean_pipeline.curate --check
python -m unittest discover -s python/tests -v
npm run check
```

`--check` falla si falta un archivo limpio o difiere de los extractos
versionados. CI ejecuta esta comprobación. La acción **Refresh regional OBIS
extracts** obtiene de nuevo los 54 ámbitos, construye los diez archivos y
publica todo como artefacto para revisión. No modifica `main`: para actualizar
la web hay que revisar y versionar juntos extractos, manifiestos y archivos
limpios. Una nueva fecha de consulta puede cambiar los registros de OBIS.

## Contrato del archivo limpio (esquema 1, pipeline 2)

| Campo | Contenido |
| --- | --- |
| `schemaVersion`, `pipelineVersion` | Versiones del contrato y de la transformación. |
| `species` | ID estable, nombre científico latino, nombre común, grupo (`fish`, `cetacean`, `reptile`) y AphiaID. |
| `sourceScopes[]` | ID de ámbito y del extracto, región, periodo, límites y fechas de consulta; si aplica, diámetro de agrupación. Cada dataset conserva UUID, URL, cita, licencia de metadatos, fecha de acceso y SHA-256 del extracto. `recordMetadata` cuenta por ámbito los valores de método y licencia de las filas aceptadas, incluidos los ausentes. |
| `observations[]` | ID de OBIS, ámbito, fecha, longitud y latitud WGS84, incertidumbre declarada en metros o `null`, `basisOfRecord`, protocolo, licencia y titular de derechos de la fila y `occurrenceID` de origen cuando existen. Los ausentes permanecen `null`. |
| `quality` y `sourceScopes[].quality` | `rawFetched`, `staged`, `accepted`, descartes previos al staging, descartes posteriores por motivo, incertidumbre desconocida y rango por ámbito. |

Las igualdades `rawFetched = staged + upstreamRejected` y
`staged = accepted + rejectedByReason` deben cumplirse por ámbito y en el
agregado. Un ID repetido, ámbito desconocido, metadato no revisado, posición
fuera de límites, consulta truncada o extracto cuya huella no coincide detiene
la generación. No se fabrican valores para fechas o incertidumbre ausentes.

La interfaz presenta una ficha por caja seleccionada con el ámbito OBIS, el
recuento de esa caja, los totales y motivos de descarte del ámbito, límites y
fechas de consulta, incertidumbre, método, licencias y límites de muestreo.
Los IDs enumerados en la ficha identifican exactamente las filas de
`observations[]` de esa caja en el archivo limpio. Una misma consulta puede
producir varias cajas; **los descartes y el método son del ámbito completo**,
mientras que los IDs, la incertidumbre y las licencias de la caja proceden de
sus registros. El enlace al manifiesto conserva la consulta y sus contadores
anteriores al staging. La ficha no describe destinos ilustrativos como datos
observados. Consulte [la revisión de derechos](rights-review.md) antes de
reutilizar registros; la web no ofrece descargas.

El archivo de rechazados enumera solo las filas **que llegaron al staging y
fueron excluidas después**. Las filas inválidas o duplicadas retiradas antes
están contabilizadas en `*.manifest.json`, sin registro individual en el
JSONL conservado. No llamamos «raw completo» a ese extracto. Conservar
eventualmente las respuestas íntegras de la API exigiría ampliar la etapa
de extracción y revisar almacenamiento y derechos.

Para incorporar otra fuente de una especie existente o una nueva especie:
definir su consulta y criterios revisados en `publish_species.py`, agregar
la especie a `speciesMetadata.json` si es nueva, versionar extracto y
manifiesto, regenerar los archivos limpios y revisar los contadores y la
visualización en una PR. Los movimientos actuales siguen siendo una
simulación separada; cualquier predicción futura necesita su propio modelo,
validación y procedencia.
