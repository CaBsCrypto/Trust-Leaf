# AUD-02: conservar preparacion al cancelar descarte

Base: `7ccb908` (PR46 integrado). Rama: `fix/dispensary-draft-guard`.

Reproduccion en navegador aislado, 27/09: preparar lote y 5 g en tratamiento t2,
seleccionar t3 y mantener el dialogo abierto. Antes de corregir, el selector ya
mostraba t3. La asercion `treatment stays unchanged while discard is pending`
fallo (`t3 !== t2`). No es solo una inferencia estatica.

Correccion: esperar `mayLeave()` tanto al cambiar paciente como tratamiento,
igual que al volver al listado. Cancelar no cambia seleccion ni formulario.

Regresion PASS con encargado y operador en 360, 390, 768, 1024 y 1440 px:
- Tratamiento pendiente conserva t2; cancelar conserva lote y 5 g.
- En escritorio, cambiar paciente y cancelar conserva paciente y 5 g.
- Confirmar descarte cambia a t3 y restablece el formulario.
- Suite existente: navegacion, errores, revocacion, doble clic y recuperacion
  tras respuesta perdida PASS con datos sinteticos.

No hubo solicitudes de negocio a produccion. La prueba de respuesta perdida
es una escritura interceptada en memoria, no una entrega publicada.
Tipos (`npm run lint`) y compilacion (`npm run build`, 31.79s) PASS.
CI `36309391166` y preview PASS. PR47 integrado en `9291f2e` y publicado;
deployment y alias oficial contrastados, evidencia en el tablero del sprint.
AUD-03/04 y autonomia humana no quedan resueltos por esta correccion.
