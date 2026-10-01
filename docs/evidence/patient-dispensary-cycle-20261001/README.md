# Ciclo paciente y operador B: 01/10/2026

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

Sesion paciente existente, despues sesion separada temporalmente del operador
de B en el mismo navegador: logout, login y recarga. No dos pestanas para aislar
identidades. La identidad, organizacion y rol se comprobaron en cada panel.
Navegador interno del coordinador, no celular fisico ni prueba de autonomia.
Observaciones AX/DOM y capturas mostradas en el chat; no se adjuntan pantallas
autenticadas con correos conectados al repositorio ni se leen tokens.

## Evidencia por escenario

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

## Contraste del control de fecha

La entrada exploratoria con locator.fill en el navegador interno no produjo
filtrado estable en Movimientos y quedo vacia al salir del campo. No se clasifico
como defecto del producto: el control accesible date field, con setValue, conserva
2026-09-15 en Entregas y 2026-09-08 en Movimientos y limita correctamente las listas.
No se uso JavaScript para escribir estado de React ni se cambio codigo.
La incidencia previa del selector nativo de fecha sigue pendiente de contraste
manual en navegador externo y celular real; este resultado no la cierra.

## Pendientes y siguiente accion

- Encargado B: repetir lectura, saldo, lote y comprobante; abrir recepcion/ajuste
  sin guardar y revisar Equipo. No renovar permisos ni repetir entrega.
- Ambos roles: tareas humanas sin indicar botones y celular fisico, teclado y
  navegacion inferior. La observacion del agente no sustituye esas pruebas.
- Admin: reutilizar lecturas de la misma version funcional y completar solo
  faltantes. Incorporacion externa requiere privacidad minima y contacto compatible.
- Conservar pruebas pendientes de invitaciones, carreras, politica doctor-active
  y DEM-LEG-01. B y Browns siguen separados; stock de Browns no comprobado aqui.

No notas, cierres, recepciones, ajustes, invitaciones, migraciones ni cambios de
API en este recorrido. Saldo real final observado 10 g; stock final observado
60 g. Se mantiene el piloto ficticio, sin habilitacion clinica o comercial.
