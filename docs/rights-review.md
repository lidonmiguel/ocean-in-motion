# Derechos y límites de las observaciones publicadas

Esta revisión compara los campos de licencia de los **9.731 registros
aceptados** de los 54 extractos versionados con las etiquetas de licencia de
los metadatos de sus datasets OBIS. Describe el estado de estos archivos, no
resuelve la licencia aplicable a cada uso. El mapa no ofrece descargas.

| Comprobación de los archivos versionados | Resultado |
| --- | ---: |
| Ámbitos con más de un valor de `license` entre registros aceptados | 32 de 54 |
| Ámbitos con al menos un `license` ausente | 6 de 54 |
| Registros aceptados sin `license` | 518 de 9.731 |
| Registros aceptados sin `samplingProtocol` | 9.340 de 9.731 |
| Ámbitos con algún `samplingProtocol` declarado | 3 de 54 |

Ejemplos verificables en `src/data/curated/bottlenose-dolphin.json`:

- `bottlenose-california`: metadatos del dataset **CC BY-NC 4.0**; en los
  222 registros aceptados aparecen 215 campos CC0, 6 CC BY 4.0 y 1 CC
  BY-SA 4.0. La etiqueta del dataset no se asigna automáticamente a cada
  registro ni los valores de registro sustituyen sin revisión a los metadatos
  del dataset.
- `bottlenose-west-med`: metadatos del dataset **CC BY 4.0**; los 84
  registros aceptados carecen de campo `license`. El protocolo de todos ellos
  dice `visual observation from ferries`.

`sourceScopes[].recordMetadata` suma los valores originales de los registros
aceptados. Cada fila conserva `recordLicense` y `rightsHolder` para una
revisión posterior; la ficha del mapa muestra los valores del área elegida y
los del ámbito completo. `null` no concede permiso. El protocolo ausente no
significa que la observación carezca de método: la descripción puede estar
en los metadatos enlazados, sin estar declarada en la fila.

Antes de ofrecer una exportación habría que revisar los términos y la cita
de **cada dataset contribuyente**, resolver las discrepancias con sus
responsables cuando proceda, asociar a cada fila la licencia y el titular
verificados, conservar atribuciones y restricciones en el formato de salida
y revisar los registros con campos ausentes. Es una revisión editorial y de
derechos pendiente; no se infiere que la licencia más o menos restrictiva
prevalezca por comparación de cadenas. La [guía de citas de OBIS](https://manual.obis.org/citing.html)
indica citar los datasets contribuyentes y respetar sus restricciones; la
[política de OBIS](https://manual.obis.org/policy.html) describe los metadatos
de método, alcance, cita y licencia.

Los registros documentan posiciones notificadas dentro de consultas
acotadas. La ausencia de puntos fuera de esas consultas no prueba ausencia
biológica; el número de registros tampoco mide abundancia. Los permisos de
reutilización y la calidad científica son cuestiones distintas.
