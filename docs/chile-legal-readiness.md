# Preparación legal y regulatoria — piloto Chile

Revision de informacion general al 30 de septiembre de 2026 por el agente de
preparacion regulatoria. **No constituye asesoria juridica ni certifica
cumplimiento.** Antes de atencion, recetas o dispensacion reales se requiere
revision formal de abogado sanitario chileno y responsable clinico. Los datos
reales de cuentas/contactos de participantes de la demo tambien requieren
proteccion; un perfil declarado ficticio no demuestra que todo su texto lo sea.

## Conclusión

TrustLeaf debe operar por ahora solo como demo con datos sintéticos y documentos marcados `DEMO / NO VÁLIDA`. Están pendientes la definición de prestador y custodio de ficha; un expediente reglamentario; identidad, habilitación y firma válida del prescriptor; consentimiento efectivo; circuito con farmacia; privacidad y respuesta a incidentes.

La investigacion documental esta completada, no la revision profesional.
El [tablero unico](DISPENSARY_CLOSEOUT_SPRINT.md#demo-y-adopcion-30092026) mantiene
la decision de demo/incorporacion. [Marco de cumplimiento anterior](chile-legal-compliance.md)
es un antecedente historico con afirmaciones no acreditadas, no una garantia.

## Fuentes oficiales y alcance

- [Ley 20.584, texto vigente](https://www.bcn.cl/leychile/navegar?idNorma=1039348&idVersion=2026-02-16): derechos del paciente, atención a distancia, confidencialidad y ficha clínica. Los artículos 12 y 13 exigen acceso controlado, autenticidad, trazabilidad y conservación.
- [DS 41/2012 sobre ficha clínica](https://www.bcn.cl/leychile/navegar?f=2012-12-15&i=1046753&p=): registro oportuno, contenido mínimo, respaldo, restauración, control de acceso y conservación por al menos 15 años desde el último ingreso.
- [DS 6/2021 sobre prestaciones a distancia](https://nuevo.leychile.cl/servicios/Consulta/Exportar?exportar_con_notas_al_pie=False&exportar_con_notas_bcn=False&exportar_con_notas_originales=False&exportar_formato=pdf&hddResultadoExportar=1185819.2022-12-09.0.0%23&nombrearchivo=Decreto-6_09-DIC-2022&radioExportar=Normas) y [Norma Técnica 237 de MINSAL](https://portalsaluddigital.minsal.cl/wp-content/uploads/2025/01/2025.01.06_NORMA-TECNICA-PRESTACIONES-DE-SALUD-A-DISTANCIA-Y-TELEMEDICINA.pdf): identificación, consentimiento, registro, seguridad, continuidad y calidad en telemedicina.
- [Código Sanitario, artículo 101](https://www.bcn.cl/leychile/navegar?idNorma=5595&idParte=8655836&idVersion=2025-09-29): la receta es un acto del profesional habilitado respecto de una persona identificada y previamente evaluada.
- [DS 466, artículo 38](https://www.bcn.cl/leychile/Navegar?idNorma=13613&idParte=8632384): campos y suscripción de receta simple/retenida electrónica mediante firma electrónica avanzada o sistema admitido con validación del prescriptor y ClaveÚnica.
- [DS 404 sobre estupefacientes](https://www.bcn.cl/leychile/navegar?idNorma=13057&idVersion=2020-11-19) y [DS 405 sobre psicotropicos](https://www.bcn.cl/leychile/navegar?idNorma=13066&idVersion=2025-06-04): versiones oficiales mostradas 19/11/2020 y 04/06/2025. No usar los enlaces historicos de mayo/noviembre de 2020 como prueba de vigencia actual de ambos cuerpos. Aplicabilidad por sustancia/producto requiere revision especializada.
- [Ley 19.628 vigente](https://www.bcn.cl/leychile/Navegar?dt=open&idLey=19628) y [Ley 21.719](https://www.bcn.cl/leychile/Navegar/imprimir?idNorma=1209272&idParte=10527471&idVersion=2026-12-01), que entra en vigor el 1 de diciembre de 2026: datos de salud sensibles, derechos, deberes y nuevo régimen institucional. El diseño debe anticipar la nueva ley.
- [Registro Nacional de Prestadores Individuales](https://www.superdesalud.gob.cl/tramites/registro-nacional-de-prestadores-individuales-de-salud/): verificación oficial del profesional.

Un hash o identificador en una cadena pública puede continuar siendo dato personal si permite vinculación. No se deben publicar RUT, diagnósticos, recetas, notas, metadatos clínicos ni hashes confirmables sin una evaluación jurídica y de impacto.

### Distinciones de vigencia y limites de investigacion

- Ley 19.628 rige al corte; el regimen general de Ley 21.719 es diferido al
  01/12/2026. No declarar que todos los deberes del nuevo regimen ya rigen.
- [Ley 20.000, texto oficial](https://www.bcn.cl/leychile/Navegar?idNorma=235507&idVersion=2026-05-23),
  art. 8: someter alcance de cultivo personal y requisitos a abogado; no
  extrapolar esa disposicion a entrega comercial o suministro a terceros.
- [Consultas publicas MINSAL](https://www.minsal.cl/consultas-publicas-vigentes/)
  incluyen proyectos de acreditacion de plataformas (05/03/2026) y receta
  electronica (02/12/2025). El PDF de acreditacion consultado es un borrador,
  no acto aprobatorio comprobado. No comprobar un acto posterior tampoco prueba
  su inexistencia: solicitar vigencia y aplicabilidad a profesional/autoridad.
- NT 237: [Decreto exento 51, acto aprobatorio publicado el 07/12/2024](https://www.bcn.cl/leychile/Navegar?idNorma=1209134&idVersion=2024-12-07),
  contrastado por el agente regulatorio; apertura del PDF integral devolvio 403.
  La [Circular IF 514, publicada el 05/11/2025](https://www.bcn.cl/leychile/navegar?idNorma=1218225)
  tambien identifica el Decreto 51 de 18/10/2024 y NT 237. Confirma la referencia,
  no reemplaza revisar el texto integral y su aplicabilidad con profesionales.
  La ficha ISP de un producto de cannabis aparecio en un resultado oficial
  indexado, pero fallo la apertura directa. No basar una decision real en esa
  ficha sin copia oficial fechada. El circuito no es necesariamente solo magistral.
- RNPI verifica al profesional; no acredita plataforma ni establecimiento.
  No se verificaron profesionales concretos en esta revision.
- Periodos de 720 horas y grants de 24 horas son reglas del piloto, no reglas
  universales de recetas ni sustitutos del consentimiento asistencial.

## Puerta previa a demo externa

Estas evidencias se solicitan, no estan aprobadas por la investigacion.

| Control | Responsable | Evidencia requerida |
| --- | --- | --- |
| Alcance sin garantias regulatorias | PO/coordinador y abogado | Guion DEMO / NO VALIDA, sin receta valida ni entrega fisica |
| Cuentas/contactos reales | Privacidad, abogado y responsable tecnico | Inventario, finalidad/base, aviso, destinatarios, retencion, derechos y envio autorizado |
| Meet | Tecnico, privacidad y responsable clinico | Enlaces no publicos, invitados/terceros y revocacion/cancelacion; sin salud real ni grabacion no revisada |
| Datos ficticios y errores de ingreso | Tecnico y facilitador | Control de texto libre, canal y procedimiento ante datos reales ingresados accidentalmente |
| Permisos y aislamiento | Seguridad y coordinador | DEM-SEC-01 y frontera efectiva DEM-SEC-02 resueltas; expiracion/revocacion comprobadas, captura compartida sin contactos identificables |

Codigo `api/_lib/google-meet-access.ts:23` configura OPEN. No se comprobaron
admision de terceros, grabaciones ni revocacion efectiva del enlace viejo en
esta auditoria. Antes de compartirlo externamente, evaluar la configuracion
y su comportamiento; para demo de interfaz basta mostrar el acceso sin llamar.

## Preguntas y responsables de revision real

1. Abogado sanitario: definir actividad, prestador/custodio, responsables de
   datos y obligaciones si se atiende, vende, aporta, entrega o facilita cultivo.
2. Medico responsable: identidad/RNPI, pertinencia remota, consentimientos,
   exclusiones, derivacion y contingencias; no usar aprobacion Admin como licencia.
3. Responsable farmaceutico y abogado: producto concreto, condicion de venta,
   origen, establecimiento, prescripcion y control de existencias admisible.
4. Abogado frente a ISP/SEREMI/Superintendencia segun competencia: verificar
   resoluciones, acreditaciones, alcance y actos vigentes para el modelo escrito.
5. Privacidad y tecnico: contratos/subencargados, regiones/transferencias,
   derechos, restauracion integral, retencion e incidentes; calendario de
   adecuacion al 01/12/2026 y obligaciones aplicables antes de esa fecha.

## Checklist que deben validar abogado y socio clínico

- [ ] Prestador, custodio de ficha, encargado/proveedor de datos y responsabilidades contractuales.
- [ ] Autorización sanitaria y alcance territorial/operativo de telemedicina.
- [ ] RNPI, especialidad declarada, facultad prescriptiva y responsabilidad profesional.
- [ ] Identidad de médico/paciente, pertinencia remota, urgencias, derivación y contingencias.
- [ ] Consentimiento de telemedicina y evidencia en ficha, incluidos menores/representantes.
- [ ] Ficha conforme Ley 20.584 y DS 41: contenido, autoría, versiones, accesos, respaldo, recuperación, exportación y 15 años.
- [ ] Bases/finalidades, avisos, derechos, proveedores, transferencias, retención, incidentes y evaluación de impacto bajo Ley 21.719.
- [ ] Firma/suscripción válida, campos obligatorios, copia al paciente y aceptación real por farmacia.
- [ ] Catálogo y condición de venta mantenidos desde fuente autorizada.
- [ ] Exclusión técnica de estupefacientes, psicotrópicos y recetas especiales durante el MVP.
- [ ] Trazabilidad de dispensación, no reutilización y estados basados en confirmaciones fiables.
- [ ] Prueba documentada con datos sintéticos, rollback y canal de incidentes.
