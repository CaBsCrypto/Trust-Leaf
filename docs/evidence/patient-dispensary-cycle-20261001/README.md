# Ciclo paciente y dispensario B: 01/10/2026

## Version y alcance

Autorizacion a las 02:33 America/Santiago, sobre la correccion funcional PR56 /
main 199e1ae. Cierre documental [PR57](https://github.com/CaBsCrypto/Trust-Leaf/pull/57)
integrado como `95a1b2bc5a4160915ea87dd369a49a460b6e551a`: solo cuatro documentos,
sin diferencias funcionales respecto a 199e1ae. Candidato documental 194740d con
CI 36819789805 y preview aprobados; revision tecnica independiente del SHA exacto.
[CI main 36820406618 PASS](https://github.com/CaBsCrypto/Trust-Leaf/actions/runs/36820406618).
Deployment GitHub 6777008516 success vincula 95a1b2b con
trustleaf-45lynswsg-cabscryptocontacto-6028s-projects.vercel.app; Vercel
`dpl_HBw3vj6SZ4r9RSwyYvxL4hgti3cP` Ready y aliases oficiales contrastados.

Sesion paciente existente, despues sesiones separadas temporalmente del operador
y encargado de B en el mismo navegador: logout, login y recarga. No dos pestanas para aislar
identidades. La identidad, organizacion y rol se comprobaron en cada panel.
Navegador interno del coordinador, no celular fisico ni prueba de autonomia.
Observaciones AX/DOM y capturas mostradas en el chat; no se adjuntan pantallas
autenticadas con correos conectados al repositorio ni se leen tokens.

## Paciente y operador: evidencia por escenario

| Escenario | Resultado observado | Limite |
| --- | --- | --- |
| Consentimiento especifico | El usuario confirma autorizar B por 24 horas para 4119236d, nombre/correo/telefono ficticios, tratamiento y entregas; no ficha clinica | No Browns, tratamiento revocado ni invitacion externa |
| Guardado y recarga paciente | Cambio guardado, Revocar permiso, vigencia hasta 02/10/2026 02:33; persiste tras recarga y Continuar | Unica escritura de negocio prevista: ese permiso |
| Coherencia de saldo | Paciente y operador ven 30 g asignados, 20 g retirados y 10 g disponibles | Datos ficticios, no prescripcion habilitada |
| Busqueda y seleccion | Buscar Piloto encuentra un paciente; apertura explicita, permiso vigente y referencia diferenciadora | No prueba con multiples pacientes en produccion |
| Revision sin ejecucion | Lote Piloto-B-20260908 disponible, stock 60 g; cantidad 1 g, saldo hipotetico 9 g | No se pulsa Confirmar entrega; saldo real sigue 10 g |
| Retorno y descarte | Volver conserva 1 g/lote; navegar pregunta; Seguir editando conserva valores y foco vuelve al acceso intentado | Descartar afecta solo la preparacion local creada para esta prueba |
| Volver al listado | Busqueda Piloto conservada, foco en paciente; 10 g disponibles | No evalua autonomia de usuario |
| Inventario e historial del lote | Stock 60 g, Disponible; acceso interno aplica filtro de lote en Entregas y limpia busqueda incompatible | Sin recibir, ajustar ni cambiar bloqueo |
| Comprobante coincidente | 3150a49a-a8b2-4e19-a46b-a453adb7c15f: 10 g, Flor ficticia - no real, Piloto-B-20260908, 15/09 03:28 Santiago, tratamiento 4119236d; responsable visible por UUID | UUID de responsable sigue como oportunidad de legibilidad |
| Filtros Entregas | Fecha 2026-09-15 y lote devuelven ese comprobante; busqueda por referencia tambien lo recupera; limpiar reinicia fecha/lote/busqueda | Entrada de fecha comprobada mediante control accesible, no selector nativo manual |
| Movimientos | +100 g recepcion, -20 g, -10 g y -10 g entregas previas; explican stock 60 g | No se crea ni modifica movimiento |
| Filtros Movimientos | Fecha 2026-09-08 deja +100 g y -20 g; combinacion con lote/busqueda mantiene esos dos; busqueda sin coincidencias muestra vacio de filtros | No se simulo una caida de servicio en produccion |
| Gestion segun rol | Catalogo/Recepciones consultables, paginas sin registros comerciales; Equipo muestra encargado y operador | Sin Proveedores privados, crear, recibir, ajustar, invitar o retirar; servidor contrastado por regresiones aisladas anteriores, no intentos de escritura publicados |
| Recarga operador | Conserva cuenta, B y Operador; reinicia en Pacientes, permiso vigente, 10 g; Inventario sigue 60 g y comprobante recuperable | No conserva pestaña/filtros tras recarga; no es criterio prometido |

## Encargado B: 03:41-03:47 Santiago

Ingreso personal del usuario mediante Privy; se comprobo B y rol Encargado.
Se reutiliza la baseline publicada 95a1b2b, sin cambios de producto en esta rama.

| Escenario | Resultado observado | Limite |
| --- | --- | --- |
| Jornada e identidad | B, Encargado, un paciente autorizado, stock 60 g, equipo activo 2 y preparacion 4/4 plegada | No se interpreta el resumen como autonomia humana |
| Paciente y permiso | Busqueda Piloto, seleccion explicita; saldo 30/20/10 y permiso hasta 02/10 02:33:08 Santiago | Sin renovar el permiso ni modificar tratamiento |
| Revision y retorno | Lote Piloto-B-20260908, 1 g y saldo hipotetico 9 g; Volver conserva lote/cantidad | Nunca se pulsa Confirmar entrega |
| Descarte cancelado | Intentar Inventario abre dialogo; Seguir editando conserva 1 g/lote y foco retorna a Inventario | Descartar despues elimina solo esta preparacion local y vuelve al listado con busqueda Piloto y foco en paciente |
| Recepcion y ajuste | Recibir lote y Gestionar lote inicialmente plegados; Ajustar existencias plegado al abrir Gestionar lote; ambos formularios abren y cierran intactos | Sin rellenar, enviar, guardar ni poner en cuarentena |
| Inventario e historial | 60 g Disponible; acceso del lote aplica su filtro; busqueda 3150a49a y fecha accesible 2026-09-15 recuperan comprobante, producto, lote, periodo y responsable por UUID | Selector nativo manual externo/celular permanece pendiente |
| Movimientos y limpieza | Limpiar elimina busqueda/fecha/lote; alternar a Movimientos muestra +100/-20/-10/-10 g, neto 60 g | Ningun movimiento nuevo |
| Gestion comercial | Catalogo, Proveedores y Recepciones terminan la carga y muestran pagina sin registros; controles Nuevo producto/Nuevo proveedor visibles para encargado | No se crea nada; la recepcion historica de B no equivale a una recepcion comercial vinculada |
| Equipo | Un encargado y un operador activos; dos invitaciones historicas aceptadas y correo entregado al servidor receptor | Se distingue estado de invitacion/entrega; sin invitar, reenviar ni retirar |
| Recarga encargado | Identidad y acceso persisten, entrada Jornada; Pacientes 30/20/10 y permiso vigente, Inventario 60 g y comprobante 3150a49a recuperados nuevamente | No promete persistencia de filtros/seccion; navegador interno, no celular fisico |

Se cerro la sesion del encargado antes de abrir Admin y el usuario completo
personalmente el codigo de Privy. No se copian correos, contactos ni capturas
autenticadas al repositorio.

## Admin: 03:51-03:54 Santiago

Cuenta administrativa y piloto simulado comprobados en el panel oficial. Main
reconfirmado como 95a1b2b y CI 36820406618 success para ese SHA; los checks de un
nuevo commit documental se verifican por separado, sin atribuirle los anteriores.

| Escenario | Resultado observado | Limite |
| --- | --- | --- |
| Identidad y actores | Cuenta Admin correcta; ocho actores registrados, incluidos encargado/operador B activos; sin solicitudes profesionales pendientes | No cambia roles ni usa la aprobacion antigua |
| Organizaciones y membresias | A, B y Browns independientes; B conserva su encargado y operador, Browns un encargado | Se espera que terminen de cargar los correos; acceso efectivo de Browns reutilizado de evidencia anterior, no una nueva sesion Browns |
| Auditoria existente | Grant 01/10 02:33 para 4119236d y entrega 3150a49a del 15/09 visibles; resumen conserva cuatro entregas | No se procesa Calendar ni se ejecuta accion de negocio |
| Invitaciones | Una pendiente vigente y una aceptada historica; estado de entrega al servidor receptor diferenciado | No se copia el destinatario pendiente ni se reenvia, cancela o invita |
| Solicitudes y decision | Browns Aprobada; Revisar solicitud abre datos y estado existente | Sin aprobar, rechazar, corregir ni copiar el formulario privado |
| Recarga Admin | Autenticacion y cuenta administrativa persisten; entrada Actividad y mismos registros | No acredita alta externa, autonomia ni celular fisico |

Salida tecnica de este recorrido: encargado B y lecturas Admin pendientes
completados, sin defectos bloqueantes reproducidos en estas tareas. No equivale
a cerrar todas las regresiones de seguridad ni el sprint humano.

## Contraste del control de fecha

La entrada exploratoria con locator.fill en el navegador interno no produjo
filtrado estable en Movimientos y quedo vacia al salir del campo. No se clasifico
como defecto del producto: el control accesible date field, con setValue, conserva
2026-09-15 en Entregas y 2026-09-08 en Movimientos y limita correctamente las listas.
No se uso JavaScript para escribir estado de React ni se cambio codigo.
La incidencia previa del selector nativo de fecha sigue pendiente de contraste
manual en navegador externo y celular real; este resultado no la cierra.

## Pendientes y siguiente accion

- Encargado B: recorrido tecnico anterior completado; no requiere repetir entrega,
  recepcion ni ajuste para obtener evidencia. Evaluacion humana separada pendiente.
- Ambos roles: tareas humanas sin indicar botones y celular fisico, teclado y
  navegacion inferior. La observacion del agente no sustituye esas pruebas.
- Admin: lecturas de organizaciones, membresias, Incorporaciones y recarga
  completadas; no envio ni decision nueva. Incorporacion externa requiere
  privacidad minima, contacto compatible y acompanamiento.
- Conservar pruebas pendientes de invitaciones, carreras, politica doctor-active
  y DEM-LEG-01. B y Browns siguen separados; stock de Browns no comprobado aqui.

No notas, cierres, recepciones, ajustes, invitaciones, migraciones ni cambios de
API en este recorrido. Saldo real final observado 10 g; stock final observado
60 g. Se mantiene el piloto ficticio, sin habilitacion clinica o comercial.
