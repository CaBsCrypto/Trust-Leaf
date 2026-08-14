# Preparación legal y regulatoria — piloto Chile

Revisión de información general al 13 de agosto de 2026. **No constituye asesoría jurídica ni certifica cumplimiento.** Antes de usar datos reales o emitir una receta válida se requiere revisión formal de un abogado sanitario chileno y del médico responsable.

## Conclusión

TrustLeaf debe operar por ahora solo como demo con datos sintéticos y documentos marcados `DEMO / NO VÁLIDA`. Están pendientes la definición de prestador y custodio de ficha; un expediente reglamentario; identidad, habilitación y firma válida del prescriptor; consentimiento efectivo; circuito con farmacia; privacidad y respuesta a incidentes.

## Fuentes oficiales y alcance

- [Ley 20.584, texto vigente](https://www.bcn.cl/leychile/navegar?idNorma=1039348&idVersion=2026-02-16): derechos del paciente, atención a distancia, confidencialidad y ficha clínica. Los artículos 12 y 13 exigen acceso controlado, autenticidad, trazabilidad y conservación.
- [DS 41/2012 sobre ficha clínica](https://www.bcn.cl/leychile/navegar?f=2012-12-15&i=1046753&p=): registro oportuno, contenido mínimo, respaldo, restauración, control de acceso y conservación por al menos 15 años desde el último ingreso.
- [DS 6/2021 sobre prestaciones a distancia](https://nuevo.leychile.cl/servicios/Consulta/Exportar?exportar_con_notas_al_pie=False&exportar_con_notas_bcn=False&exportar_con_notas_originales=False&exportar_formato=pdf&hddResultadoExportar=1185819.2022-12-09.0.0%23&nombrearchivo=Decreto-6_09-DIC-2022&radioExportar=Normas) y [Norma Técnica 237 de MINSAL](https://portalsaluddigital.minsal.cl/wp-content/uploads/2025/01/2025.01.06_NORMA-TECNICA-PRESTACIONES-DE-SALUD-A-DISTANCIA-Y-TELEMEDICINA.pdf): identificación, consentimiento, registro, seguridad, continuidad y calidad en telemedicina.
- [Código Sanitario, artículo 101](https://www.bcn.cl/leychile/navegar?idNorma=5595&idParte=8655836&idVersion=2025-09-29): la receta es un acto del profesional habilitado respecto de una persona identificada y previamente evaluada.
- [DS 466, artículo 38](https://www.bcn.cl/leychile/Navegar?idNorma=13613&idParte=8632384): campos y suscripción de receta simple/retenida electrónica mediante firma electrónica avanzada o sistema admitido con validación del prescriptor y ClaveÚnica.
- [DS 404 sobre estupefacientes](https://www.bcn.cl/leychile/navegar?idNorma=13057&idParte=7147285&idVersion=2020-05-07) y [DS 405 sobre psicotrópicos](https://www.bcn.cl/leychile/navegar?cve=&i=&idLey=&idNorma=13066&idVersion=2020-11-19&tipoVersion=): circuitos y recetas especiales. Se excluyen del MVP hasta validación especializada punta a punta.
- [Ley 19.628 vigente](https://www.bcn.cl/leychile/Navegar?dt=open&idLey=19628) y [Ley 21.719](https://www.bcn.cl/leychile/Navegar/imprimir?idNorma=1209272&idParte=10527471&idVersion=2026-12-01), que entra en vigor el 1 de diciembre de 2026: datos de salud sensibles, derechos, deberes y nuevo régimen institucional. El diseño debe anticipar la nueva ley.
- [Registro Nacional de Prestadores Individuales](https://www.superdesalud.gob.cl/tramites/registro-nacional-de-prestadores-individuales-de-salud/): verificación oficial del profesional.

Un hash o identificador en una cadena pública puede continuar siendo dato personal si permite vinculación. No se deben publicar RUT, diagnósticos, recetas, notas, metadatos clínicos ni hashes confirmables sin una evaluación jurídica y de impacto.

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
