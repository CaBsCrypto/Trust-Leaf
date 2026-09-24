# Mesa de atencion: siguiente entrega de integracion

Estado: plan preparado, no implementado. Requiere aprobacion visual explicita.
El laboratorio no sustituye /dispensario y sus fixtures no son datos operativos.

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

## Entregas propuestas

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
4. Validacion: preview con datos aislados, ambos roles y cinco anchos; despues
   prueba acompanada de lectura en produccion sin entregas ni ajustes nuevos.

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
- La aprobacion del PR de laboratorio no equivale a aprobacion visual ni autoriza
  por si sola publicar la interfaz conectada. B, Browns y borrador mensual intactos.
