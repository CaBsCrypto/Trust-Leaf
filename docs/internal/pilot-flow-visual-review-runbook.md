# Runbook de revisión visual — flujo piloto sintético

Fecha: 2026-08-26  
Ruta: `/demo/pilot-flow`

## Precondiciones

1. Usar esta rama local; no configurar credenciales ni variables de submission.
2. Confirmar que `TRUSTLEAF_TESTNET_SUBMIT_ENABLED` y `TRUSTLEAF_ALLOW_TESTNET_MUTATIONS` no están habilitados.
3. Ejecutar `npm run test:pilot-flow-demo`, `npm run lint` y `npm run build`.
4. Iniciar el servidor local con el comando estándar del repositorio y abrir la ruta indicada.

## Guion compacto

En cada fase, seleccionar el rol requerido por el botón. Verificar que un rol distinto deje la acción deshabilitada.

1. Admin: confirmar panel vacío y auditoría sin eventos.
2. Médico: solicitar acceso.
3. Admin: aprobar para la demo.
4. Médico: publicar disponibilidad abstracta.
5. Paciente: reservar el bloque.
6. Médico: registrar consentimiento y decisión sintéticos.
7. Médico: preparar receipt simulado; comprobar la advertencia de que no existe envío ni prueba Testnet nueva.
8. Paciente: abrir el directorio condicionado.
9. Dispensario: verificar el handle opaco, registrar parcial y después total. Confirmar que no aparece cantidad.
10. Admin: abrir la auditoría y comprobar diez eventos ordenados.
11. Pulsar “Reiniciar fixtures” y confirmar que vuelve al panel vacío.

## QA visual y accesible

- Desktop: 1440 × 900 y viewport estrecho cercano a 768 px.
- Móvil: 390 × 844; sin scroll horizontal, solapamiento o controles fuera de pantalla.
- Teclado: recorrer enlace de salto, cuatro roles, acción principal y reinicio; el foco debe ser visible.
- Reduced motion: activar la preferencia del sistema y comprobar que transiciones/scroll quedan prácticamente anulados por la regla global.
- Contraste/semántica: revisar encabezados, `progressbar`, grupos de roles, estado, alertas y botones disabled.

## Negativos humanos

- En el inicio, seleccionar Paciente e intentar avanzar: el botón debe permanecer deshabilitado y pedir rol Médico.
- Tras solicitar acceso, mantener Médico: el botón debe pedir rol Admin.
- El QR completo no se presenta; sólo un handle truncado y explícitamente sintético.
- No debe aparecer identidad, contacto, ficha, diagnóstico, indicación, dosis, cantidad, dirección, wallet, secreto o claim de validez.
- No debe haber requests de red causadas por esta ruta. El QA Browser debe revisar consola y red.

## GO / NO-GO

GO sólo para revisión humana local si pruebas, build, responsive, teclado y privacidad están verdes. Continúa NO-GO para personas reales, práctica clínica, persistencia, Testnet V2 o producción. El enlace a evidencia Stellar se habilita únicamente cuando un lector sanitizado y un manifest allowlisted demuestren evidencia finalizada; esta candidata no lo hace.

