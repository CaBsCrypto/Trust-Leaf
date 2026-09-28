# Proteccion de notas medicas sin guardar

Fecha: 2026-09-27. Base: `a9ddc67` (PR48). Rama: `fix/medical-note-guard`.
Sin cambios de API, migraciones, permisos o datos publicados.

## Reproduccion

Agente medico reprodujo en navegador y PGlite aislados sobre la base:
- Cambiar de seccion borra una nota no guardada.
- Finalizar con tratamiento y sin tratamiento cierra la consulta sin esa nota.
Los tres escenarios fallaron las expectativas protectoras antes del cambio.
Esto demuestra perdida de texto local, no perdida de notas ya persistidas.

## Correccion

- Borrador controlado por reserva, solo en memoria de la sesion.
- Buscar y filtrar no destruye borradores; cambiar de seccion requiere descarte.
- Descartar al intentar finalizar no ejecuta el cierre; se requiere otra accion.
- Guardado confirmado conserva el texto hasta recuperar la lectura actualizada.
- Conflicto conserva texto/version; adoptar version nueva es una accion explicita.
- Cierre o cancelacion en otra sesion mantiene el texto local de solo lectura si
  el medico sigue autorizado. Perdida de acceso o identidad retira el texto.
- Un comando incierto conserva su ID para reintento de la misma sesion; no se
  ofrece reintento sin lectura autorizada. Abandonar recuperacion advierte al usuario.
- Dialogo React compartido, Escape/cancelacion, foco y aviso nativo antes de salir.
  No hay autosave ni almacenamiento local de notas.

## Evidencia y puertas de salida

Agente medico: diez grupos de regresion, 360/390/768/1024/1440 px, version
concurrente, lectura fallida, identidad y guardado aplicado con respuesta perdida
seguido de GET403, recuperacion y reintento: una sola nota. Filtros medicos y
navegacion consulta-agenda aprobados; un timeout de popup se repitio y paso.
Capturas sinteticas en `scratch/medical-note-guard/`, no datos reales.

Coordinador: tipos, API 8/8, SQL aislado, presupuesto de funciones y regresiones
visuales aprobados. Build aprobado con advertencias conocidas de Privy/chunks.
Agente de calidad ejecuto `operations-browser.mjs` en PGlite fresco: PASS del
recorrido medico/paciente/dispensario, sin operaciones sobre datos publicados.
Revision independiente de UX y calidad incorporada. El ultimo candidato debe
pasar CI y preview antes de integrar. No equivale a prueba humana en celular.

Inventario se reproduce por separado y no se corrige en esta rama. Su prueba
de caracterizacion queda fuera de este commit hasta la siguiente entrega.
