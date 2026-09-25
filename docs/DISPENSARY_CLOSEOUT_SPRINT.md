# Sprint S1: cerrar la experiencia publicada del dispensario

Actualizado: 2026-09-25. Sprint de una semana de referencia, sin fecha final
comprometida hasta disponer de ambos participantes. Sin ejecucion automatica.
Fuente de estado: este tablero, enlazado desde el plan maestro y mapa de producto.

## Objetivo, responsables y reglas

### Evidencia incremental: 25/09, 02:09 Chile

Comprobacion del agente en navegador interno sobre version publicada d101469;
no acredita autonomia humana ni telefono fisico. Sustituye el bloqueo inicial B1
solo para encargado. Operador y evaluaciones U1-U4 permanecen pendientes.

- Encargado B autenticado; Jornada confirma 60 g, dos miembros y un paciente
  autorizado. Tras recarga conserva organizacion/rol, valores y cero entregas hoy.
- Paciente: tratamiento de prueba 4119236d con 30 g asignados, 20 g retirados y
  10 g disponibles. Con confirmacion explicita del usuario se concedio permiso
  a B hasta 26/09 02:02 Chile. No se modificaron tratamiento, saldo o stock.
- Atenciones: seleccion explicita y revision de 10 g desde Piloto-B-20260908;
  saldo hipotetico 0 g, SIN confirmar entrega. Luego se observo listado limpio.
- Busqueda por referencia, apertura y retorno conservan texto y foco en paciente.
- Inventario -> historial aplica filtro de lote y muestra comprobante existente
  3150a49a-a8b2-4e19-a46b-a453adb7c15f de 10 g. Responsable se muestra por UUID:
  oportunidad de legibilidad, sin afirmar identidad nominal desde esa referencia.
- Gestion: Catalogo y Proveedores terminan carga con pagina vacia, no error;
  formularios no abiertos. Equipo muestra un encargado y un operador, dos
  invitaciones aceptadas historicas no equivalen a dos membresias activas.
- No se enviaron invitaciones, retiraron miembros ni guardaron operaciones.
  Descarte/cancelacion de preparacion fue guiado al usuario: falta evidencia
  detallada para dar por aprobados todos los pasos J04.
- Pendiente: filtros combinados/movimientos J06, operador, dispositivo fisico y
  autonomia. El permiso es temporal; comprobar nuevamente antes de otra sesion.

Encargado y operador encuentran paciente, explican saldo, localizan lote y
recuperan comprobante desde computador y celular, sin ayuda de navegacion.

- Product Owner (usuario): prioridad, aprobacion y coordinacion del dispensario.
- Facilitador tecnico (agente, funcion Scrum Master): tablero, bloqueos,
  implementacion, evidencias y revision; no sustituye evaluacion humana.
- Encargado y operador: realizan tareas y contrastan su operacion real.
- Flujo: Backlog -> Preparado -> En curso -> Validacion -> Cerrado. Bloqueado
  es una condicion explicita, no cierre. Maximo una entrega funcional En curso.
- Inicio de sesion: objetivo/bloqueos; cierre: evidencia, pendientes y siguiente
  accion. Revision y retrospectiva al terminar el sprint, no solo al publicar.
- Prioridad: seguridad/datos, fallo de flujo, friccion frecuente, visual, oportunidades.

## Fases y puertas de salida

| Fase | Salida requerida | Estado |
| --- | --- | --- |
| 0 Consolidar | Version, evidencia y pendientes coherentes | Cerrado en esta documentacion |
| 1 Validar jornada | Ambos roles recorren tareas; ayuda y defectos registrados | Validacion; bloqueada por sesiones |
| 2 Resolver fricciones | Defectos relevantes corregidos y tareas repetidas | Backlog; depende de observaciones |
| 3 Presentacion | Acceso primer encargado, datos separados y feedback registrado | Backlog |
| 4 Ampliar suite | Objetivo y reglas aprobados por modulo | Backlog; no construir por suposicion |

## Base comprobada y limites

- Producto: https://www.trustleaf.org/dispensario; laboratorio local 4330 excluido.
- Main `d101469e51888f6a33bc8c007267beba265d81a3`, PR #42 fusionado.
- CI https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36072522968 aprobado
  sobre `668d84f41f9f20aebca3b394670e2630755735c8`; preview aprobada.
- Vercel `dpl_d6Amae2MsKf8prLTEYno8ix2Ah9R`, production Ready y alias oficial
  reconfirmados el 25/09. Capturas sinteticas: `docs/evidence/desk-connected`.
- Ambos roles y 360/390/768/1024/1440 px probados tecnicamente. No equivale a
  dispositivo fisico, teclado movil ni usuario trabajando sin ayuda.
- Sesion oficial observada: Admin, sin acceso de dispensario. No es un defecto
  demostrado. Cuenta de encargado/operador, stock, saldo y permiso: sin comprobar.
- No confirmar entregas, recepciones, ajustes, cuarentenas, invitaciones ni retiro
  de miembros en este recorrido. No reiniciar saldos ni modificar tratamientos.
- Sin APIs, contratos, permisos o migraciones nuevas. B, Browns y borrador mensual
  intactos. Autenticacion real; contenido clinico/inventario exclusivamente ficticio.

## Tablero unico

| ID / actor | Problema y resultado esperado | Estado / responsable | Aceptacion, dependencia y evidencia |
| --- | --- | --- | --- |
| S1-01 / todos | Docs decian pendiente aunque PR42 publicado; base univoca | Cerrado / facilitador | Version/CI/Vercel contrastados; base anterior y E7 en mapa |
| S1-02 / ambos roles | Falta evaluar uso real del nuevo marco | Validacion, BLOQUEADO / facilitador + participantes | Todos los casos siguientes sin ayuda; requiere sesiones y permiso; evidencia humana pendiente |
| S1-03 / ambos roles | Fricciones aun no observadas; resolver solo hallazgos | Backlog / facilitador | Hallazgo reproducible, regresion, CI/preview y repeticion humana; depende S1-02 |
| S1-04 / encargado | Gestion conserva funciones pero falta evaluar claridad | Preparado / facilitador + encargado | Encontrar catalogo, proveedores/equipo y volver, sin guardar; sesion requerida |
| S1-05 / PO | Falta decision de cierre y siguiente prioridad | Backlog / PO + facilitador | Revision con resultados, bloqueos y retrospectiva; depende S1-02/03/04 |
| P-01 / primer encargado | Acceso de Browns aun no comprobado | Backlog / PO + encargado | Organizacion/rol correctos tras sesion nueva; no mover miembros de B |
| P-02 / dispensario | Preparar presentacion basada en funciones disponibles | Backlog / PO + facilitador | Guion reproducible, datos ficticios separados, sin acceso directo a base; depende P-01 y S1 |
| SEP-01 / equipo | Negativos de invitaciones y otros pendientes historicos | Backlog separado / facilitador | Reconciliar evidencia por caso antes de pruebas; S1 no los declara cerrados |

Bloqueo B1: se necesita sesion de encargado u operador. Usar perfiles o dispositivos
separados; dos pestanas comunes no aislan identidad. Solicitud de acceso enviada
al usuario el 25/09, sin pedir contrasenas ni codigos. No cerrar Admin sin indicacion.
Bloqueo B2 condicional: permiso/tratamiento no aptos. Solo el paciente renueva
explicitamente si puede; de lo contrario detener ese caso y seguir lecturas permitidas.

## Protocolo de prueba y evidencia

Primero enunciar la tarea, sin indicar botones. El participante ejecuta; el agente
puede verificar tecnicamente despues, pero no adjudicarse autonomia humana.
Registrar ayuda literalmente. Con ayuda, el caso queda observado y requiere
revision/repeticion, no aprobado por autonomia.

| Caso | Tarea / resultado esperado |
| --- | --- |
| J01 | Identificar cuenta, rol, organizacion y piloto; leer saldo/stock actuales sin asumir valores |
| J02 | Encontrar paciente por nombre/referencia, elegir tratamiento y explicar disponible, asignado y retirado |
| J03 | Identificar lote utilizable y por que uno bloqueado no permite seleccion; revisar cantidad valida SIN confirmar |
| J04 | Volver, cancelar descarte y conservar preparacion; descartarla explicitamente; conservar busqueda al regresar |
| J05 | Encontrar lote en Inventario, abrir su historial y recuperar comprobante existente; explicar producto, cantidad y responsable |
| J06 | Alternar entregas/movimientos, combinar/limpiar filtros; error de lectura nunca se interpreta como cero |
| J07 | Recargar, volver a entrar y comprobar datos/permisos; operador sin gestion administrativa; no probar escrituras denegadas en vivo |
| J08 | Encargado localiza Gestion/catalogo/proveedores/equipo; formularios inicialmente plegados, abrir/cerrar sin guardar |

J01-J07: cada rol en escritorio y celular real. J08: encargado en ambos.
Casos sin datos de ejemplo quedan pendientes; no generar movimientos para cubrirlos.
Errores y revocaciones provocadas se reproducen en entorno aislado; no retirar
permisos publicados solo para obtener evidencia. Comprobar foco y teclado movil.

| Sesion | Rol / dispositivo | Casos | Resultado |
| --- | --- | --- | --- |
| U1 | Encargado / escritorio | J01-J08 | Pendiente de acceso |
| U2 | Encargado / celular real | J01-J08 | Pendiente |
| U3 | Operador / escritorio | J01-J07 | Pendiente |
| U4 | Operador / celular real | J01-J07 | Pendiente |

Por caso registrar: fecha, version, rol, dispositivo/navegador/ancho, esperado,
observado, ayuda, resultado (aprobado/fallido/pendiente), evidencia y defecto ID.
No incluir tokens, contactos o capturas clinicas reales. Referencias completas
solo cuando sean de prueba y necesarias; capturas sanitizadas.

## Defectos, oportunidades y cierre

No hay un defecto nuevo confirmado por esta consolidacion. Registro inicial:

| ID | Problema / actor | Frecuencia | Beneficio | Riesgo / esfuerzo | Decision |
| --- | --- | --- | --- | --- | --- |
| O1 Gestion | Posible dificultad para encontrar herramientas / encargado | Por medir | Menos ayuda | UI compartida / por estimar | Observar S1-04 |
| O2 Compras | Pedidos/recepciones parciales / encargado | Por confirmar | Pendientes trazables | Stock/concurrencia / alto preliminar | Descubrimiento con dispensario |
| O3 Documento/Caja | Cobro opcional y conciliacion / ambos | Por confirmar | Separar entrega y cobro | Dinero/roles / alto preliminar | Confirmar venta/aporte/membresia |
| O4 Conteos | Diferencias fisicas / encargado | Por confirmar | Ajustes explicables | Bloqueos/stock / alto preliminar | Acordar excepciones |
| O5 Reportes | Informacion para decisiones / encargado | Por confirmar | Control diario | Privacidad/datos faltantes / por estimar | Depende de modulos y preguntas reales |

Defecto nuevo: ID, caso, severidad, reproduccion, evidencia, responsable y prueba
de regresion. Critico de seguridad/datos detiene escenario; una desactivacion de
capacidad requiere procedimiento seguro, nunca borrar historial ni volver a Firebase.
Toda correccion: tipos, build, regresiones, CI/preview y verificacion posterior.

Presentacion inicial: preparar -> localizar autorizado -> explicar saldo -> revisar
sin ejecutar -> encontrar lote y comprobante -> explicar equipo. No presentar
Compras/Caja/Conteos como operativos. Preguntar herramientas actuales, tareas
frecuentes, excepciones, roles, formatos y modelo economico; no asumir respuestas.

Revision actual: consolidacion tecnica completada; prueba humana bloqueada por
sesiones. Ninguna funcion nueva ni escritura de negocio. Siguiente accion:
encargado entra y realiza J01-J02; seguir el protocolo sin tutorial inicial.
Cierre S1 solo con ambas evaluaciones, defectos relevantes resueltos, evidencia
actualizada y siguiente prioridad aprobada. Retrospectiva: que funciono, donde
hubo ayuda y un cambio concreto al proceso para la proxima iteracion.
