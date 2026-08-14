# Piloto sintético con el primer médico

## Experiencia objetivo

La pantalla inicial debe responder “¿qué tengo que hacer hoy?”: próxima consulta, pacientes esperando, consentimientos pendientes, borradores de receta y ayuda. Desde una cita, el médico debe llegar en no más de dos acciones a la ficha correcta y ver de inmediato si el permiso está vigente.

Flujo: agenda → llegada e identidad → consentimiento con alcance/vencimiento → ficha autorizada → consulta y nota con borrador → cierre → vista previa de receta → firma de prueba explícita → estado y trazabilidad → soporte. La receta es el resultado de la consulta, no el centro de la experiencia. Wallets, hashes, testnet y contratos quedan ocultos en “Detalles técnicos”.

Estados de receta: borrador, pendiente de firma, firmada en prueba, entrega parcial, completada, revocada, vencida y error. Ningún fallback puede declarar una receta emitida: si falta firma, solo crea una vista previa `DEMO / NO VÁLIDA`.

## Onboarding (30 minutos)

1. Explicar alcance sintético, exclusiones y canal de ayuda (5 min).
2. Configurar tres bloques de agenda y revisar alertas (5 min).
3. Ejecutar consulta ficticia: identidad, consentimiento, ficha y nota (10 min).
4. Crear/revisar una vista previa de receta y simular una entrega (7 min).
5. Recoger fricciones y encuesta breve (3 min).

## Entrada al piloto sintético

- Entorno aislado sin datos personales reales; personajes y documentos ficticios.
- Mutaciones deshabilitadas por defecto y apertura temporal autorizada solo en testnet.
- Matriz de roles probada: anónimo 401, rol incorrecto 403, rol autorizado limitado a su paciente/acción.
- Consentimiento efectivo, ficha cifrada, auditoría y recuperación comprobadas antes de migrar desde demo local.
- Exclusión de medicamentos controlados y rótulo visible de no validez.
- Médico conoce contingencia, soporte y prohibición de urgencias por la app.

## Salida / éxito

- Cinco recorridos completos sin fuga entre pacientes, doble emisión ni pérdida de borradores.
- Auditoría reconstruye actor, acción, recurso, versión, momento y resultado.
- Al menos 80% de tareas sin asistencia y creación revisada de receta en menos de 90 segundos.
- Cero P0 abiertos; médico confirma utilidad de agenda + nota + receta.
- Abogado y socio clínico aprueban por escrito matriz requisito → evidencia antes de datos/recetas reales.

## Decisiones reservadas al usuario

- Contratar/designar abogado sanitario, socio clínico responsable y responsable de privacidad.
- Definir entidad prestadora/custodio, modelo contractual, farmacia asociada y alcance territorial.
- Autorizar presupuesto/proveedores, proyecto cloud aislado, firma e identidad del médico.
- Aprobar apertura temporal de testnet, push remoto, despliegue no productivo y fecha del piloto.
- Autorizar por separado cualquier paso futuro con datos reales, receta válida o producción.
