# Mesa de atencion: integracion publicada

Estado al 2026-09-25: aprobacion visual explicita recibida el 2026-09-24.
Navegacion y Atenciones publicadas mediante PR #42, main `d101469`.
El laboratorio permanece separado; /dispensario usa datos y permisos existentes,
no fixtures. El cierre humano se gestiona en [el sprint](DISPENSARY_CLOSEOUT_SPRINT.md).

La integracion usa los datos y acciones existentes de OperationsWorkspace.
Conserva Gestion/Equipo en cabecera, tratamientos multiples y confirmacion de
entrega. Inventario e Historial conservan sus funciones bajo el nuevo marco;
el refinamiento detallado de Gestion permanece como entrega posterior.
Validacion local: tipos y build aprobados; atencion, jornada, inventario,
historial y comercio comprobados en ambos roles y cinco viewports. El recorrido
SQL completo y CI `36072522968` terminaron aprobados antes de fusionar.
Preview aprobada y despliegue de produccion Ready confirmado. La sesion oficial
disponible es Admin: no acredita una prueba autenticada de encargado/operador.
No se modifican APIs, contratos, migraciones ni datos publicados.

## Correspondencia con el producto

| Control de Mesa | Fuente y comportamiento que se conserva |
| --- | --- |
| Identidad, organizacion, rol | OperationsWorkspace y sesion Privy; sin equipo no mostrar datos operativos. |
| Lista y busqueda | DispensaryAttention: tratamientos y permisos vigentes del snapshot autorizado, perfiles opcionales y referencias. |
| Saldo | Periodo vigente del tratamiento elegido; no sumar tratamientos ni usar cantidades del laboratorio. |
| Lotes | DispensingForm y batches autorizados: estado, vencimiento y stock reales; no copiar motivos sinteticos. |
| Revision y entrega | Conservar formulario y confirmacion existentes; execute conserva bloqueo, comando recuperable e identificador de operacion. |
| Comprobante | deliveries autorizadas y receiptRef; mostrar resultado persistido, nunca fabricar comprobantes. |
| Actualizacion | Lectura al recuperar foco/conexion y cada 15 segundos; errores bloquean confirmacion, revocacion retira datos. |
| Inventario e historial | Mantener filtros, acceso por lote, entregas y movimientos existentes. |
| Gestion | Mantener CommercePanel (catalogo, proveedores, recepcion) y equipo por invitacion, segun banderas y rol. |

## Alcance integrado y validacion pendiente

1. Estructura: estilos aislados del dispensario, lateral desde 1024 px y barra
   inferior movil con Jornada, Pacientes, Inventario e Historial. Gestion permanece
   accesible por un boton de cabecera con texto e icono, segun permisos actuales.
   Encargado inicia en Jornada; operador en Pacientes. No agregar Caja o Compras.
2. Atencion: extraer componentes visuales sin importar fixtures ni estado global
   del laboratorio. Conservar seleccion de tratamiento, perfil pendiente,
   contactos autorizados, periodos y trazabilidad. Sustituir confirmaciones nativas
   de descarte por dialogo React accesible; mantener beforeunload.
3. Inventario, Historial y Gestion: aplicar el marco visual sin quitar recepcion,
   ajustes, vinculacion, archivo, filtros ni acciones de equipo autorizadas.
4. Validacion tecnica: datos aislados, ambos roles y cinco anchos aprobados.
   Pendiente prueba acompanada de lectura en produccion, sin entregas ni ajustes.

## Invariantes y puertas de salida

- Mantener APIs, contratos, permisos, reglas de servidor e idempotencia.
- No importar data.ts del laboratorio; sin saldo, estado ni recibos optimistas.
- Error de transporte no equivale a revocacion ni a lista vacia.
- Cambio de identidad elimina seleccion, borradores y datos protegidos.
- Preservar busqueda y retorno de foco/posicion; confirmar descarte al navegar.
- Probar multiples tratamientos, agotados, vencidos, revocados, cuenta retirada,
  doble clic y respuesta perdida. No inventar un motivo de bloqueo sin datos.
- Tipos, build, regresiones, revision, CI y preview antes de merge.
- Evidencia responsive en 360/390/768/1024/1440 no sustituye dispositivo real.
- La aprobacion visual y publicacion no equivalen a autonomia de uso validada.
  B, Browns y borrador mensual intactos.
