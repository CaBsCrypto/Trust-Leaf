# Trust Leaf Roadmap De Proximos Sprints

Este documento ordena el camino desde demo/proof-of-concept hacia el primer MVP
funcional, grabable y verificable en Stellar Testnet.

## Objetivo

Pasar de una demo convincente a un flujo operativo donde:

1. cada actor ve solo lo necesario para trabajar;
2. el medico atiende una consulta real antes de emitir receta;
3. el paciente controla ficha, permisos, recetas y trazabilidad;
4. el dispensario valida receta, saldo y lote sin ver ficha clinica completa;
5. admin mantiene la red confiable y conecta actores con Testnet;
6. Stellar/Soroban prueba autorizaciones, recetas, saldos y retiros parciales.

La regla base no cambia: la ficha clinica completa nunca va on-chain. La
blockchain prueba estado, integridad y trazabilidad; la DB privada guarda datos
clinicos y operacion sensible.

## Sprint 0: QA Y Limpieza De Demo

Objetivo: dejar las rutas actuales listas para mostrar sin explicar demasiado.

Alcance:

- revisar `/paciente`, `/medico/operacion`, `/dispensario/operacion`,
  `/admin` y `/mvp`;
- quitar de paciente, medico y dispensario textos tecnicos como Testnet,
  hash, signer, faucet, contratos, MVP o demo interno;
- mantener detalles tecnicos solo en `/admin` y `/mvp`;
- validar mobile, drawers, botones, rutas legacy y textos visibles;
- corregir cualquier encoding roto visible.

Definition of Done:

- `npm run lint` pasa;
- `npm run build` pasa;
- las rutas principales cargan;
- paciente, medico y dispensario entienden su siguiente accion sin leer
  contexto tecnico.

## Sprint 1: Medico Como Workspace Real

Objetivo: convertir el panel medico en una mesa de consulta simple.

Alcance:

- agenda del dia;
- bloques horarios editables;
- paciente en consulta;
- validar llegada o QR;
- abrir ficha autorizada;
- guardar resumen clinico;
- emitir receta solo desde consulta activa o finalizada.

Regla de producto:

- la receta no debe ser una pantalla aislada;
- la receta nace desde una consulta seleccionada;
- sin paciente validado o consulta cerrada, la receta queda bloqueada.

Definition of Done:

- medico crea disponibilidad;
- paciente reserva;
- el horario queda bloqueado;
- medico inicia consulta;
- medico guarda resumen;
- medico puede preparar receta desde esa consulta.

## Sprint 2: Paciente Dueno De Su Ficha

Objetivo: hacer que el paciente sienta que controla su informacion clinica.

Alcance:

- ficha clinica privada;
- examenes y documentos;
- permisos activos;
- compartir con medico especifico;
- revocar acceso;
- QR para consulta;
- recetas activas.

Regla de producto:

- el paciente debe ver claramente quien tiene acceso, a que datos y hasta
  cuando;
- el QR no contiene datos clinicos completos, solo una referencia temporal;
- todo acceso clinico sensible debe ser temporal y revocable.

Definition of Done:

- paciente comparte ficha con un medico por 24h;
- medico ve solo lo autorizado;
- paciente revoca;
- UI muestra acceso revocado.

## Sprint 3: Admin Real Y Persistencia Minima

Objetivo: consolidar Firebase como persistencia inicial y proteger admin.

Alcance:

- solicitudes medicas;
- solicitudes de dispensarios;
- admin allowlist `appAdministrators/{uid}`;
- estados `pending`, `needs_review`, `approved`, `rejected`;
- `onchainStatus`: `pending`, `registered`, `failed`;
- localStorage queda solo como fallback demo controlado.

Definition of Done:

- admin real entra con Firebase;
- usuario no admin queda bloqueado;
- solicitudes persisten al recargar;
- aprobacion DB y registro on-chain siguen siendo estados separados.

## Sprint 4: Dispensario Operativo

Objetivo: convertir el dispensario en una mesa de entrega autorizada.

Alcance:

- inventario por producto/lote;
- validar QR o numero de receta;
- ver receta vigente, formatos permitidos y saldo;
- ver retiros previos de esa receta, no historial clinico general;
- registrar retiro parcial;
- mostrar comprobante simple.

Regla de producto:

- usar lenguaje medico-operativo: retiro autorizado, cantidad, saldo, lote;
- evitar lenguaje e-commerce: carrito, compra, monto estimado;
- trazabilidad tecnica queda en drawer o `/admin`, no en primer plano.

Definition of Done:

- dispensario valida receta;
- selecciona lote;
- registra retiro parcial;
- paciente ve retiro y trazabilidad.

## Sprint 5: Stellar Testnet Completo

Objetivo: conectar la historia principal con contratos reales de Testnet.

Alcance:

- admin registra medico en `DoctorRegistry`;
- admin registra dispensario en `DispensaryRegistry`;
- medico emite receta en `Prescription`;
- dispensario registra retiro en `DispenseRecord`;
- paciente ve saldo restante e historial.

Regla de producto:

- la UI de actores es simple;
- `/admin` y `/mvp` muestran tx, contrato, readiness y errores tecnicos;
- la demo usa Stellar Testnet, nunca mainnet.

Definition of Done:

- una receta de 30g permite retiro de 5g;
- el saldo queda en 25g;
- el paciente ve el retiro;
- el dispensario no ve diagnostico ni ficha clinica completa.

## Sprint 6: Receta Con Saldo Parcial Robusto

Objetivo: endurecer los contratos Soroban para consumo realista.

Alcance:

- receta soulbound/no transferible;
- `total_quantity`;
- `dispensed_quantity`;
- `remaining_quantity`;
- expiracion;
- retiros parciales por multiples dispensarios;
- error claro si se excede el saldo;
- eventos tipados para receta emitida y retiro registrado.

Definition of Done:

- tests Soroban cubren emision;
- tests cubren expiracion;
- tests cubren retiro parcial;
- tests cubren exceso de saldo;
- tests cubren dispensario no autorizado.

## Sprint 7: Wallets Y Firma Por Actor

Objetivo: reemplazar progresivamente la firma server-side de demo.

Alcance:

- paciente con smart wallet/passkey como direccion principal;
- medico firma receta con wallet/passkey o Freighter;
- dispensario firma retiro;
- Trust Leaf puede patrocinar fees en testnet/demo;
- server-side signer queda solo como modo demo/admin controlado.

Definition of Done:

- el usuario entiende su wallet como credencial, no como requisito de saldo;
- la UI no pide faucet al usuario final;
- el modo custodial queda claramente limitado a demo/testnet.

## Sprint 8: Privacidad Y Seguridad MVP

Objetivo: definir e implementar el minimo serio de privacidad clinica.

Alcance:

- almacenamiento cifrado para ficha clinica;
- almacenamiento cifrado para examenes;
- almacenamiento cifrado para documentos medicos/legales;
- almacenamiento cifrado para resumen clinico;
- permisos por alcance: sintomas, examenes, historial terapeutico, receta y
  ventana temporal.

Regla de arquitectura:

- on-chain solo hashes, estados, vigencia, saldo y eventos;
- QR solo referencia temporal;
- llaves de cifrado no deben vivir mezcladas con el contenido clinico.

Definition of Done:

- ningun diagnostico, imagen o documento completo aparece on-chain;
- ningun dato clinico completo aparece dentro del QR;
- paciente puede revocar permisos.

## Sprint 9: Pilot Readiness

Objetivo: preparar una version defendible para socio, grant o piloto.

Alcance:

- guion de demo actualizado;
- seed/reset de datos demo;
- mensajes de error humanos;
- analytics basicos;
- checklist de seguridad;
- terminos minimos;
- documentacion de arquitectura;
- checklist de grabacion de 5 a 7 minutos.

Definition of Done:

- se puede grabar el ciclo completo:
  admin aprueba, medico atiende, paciente autoriza, receta se emite,
  dispensario retira parcialmente y paciente ve trazabilidad;
- el proyecto puede explicarse como MVP verificable, no solo maqueta.

## Prioridad Recomendada

1. Sprint 0: limpiar y validar lo que ya existe.
2. Sprint 1: medico workspace real.
3. Sprint 2: paciente dueno de ficha.
4. Sprint 4: dispensario operativo.
5. Sprint 3 y Sprint 5 en paralelo si se busca llegar rapido a Testnet con
   admin real.
6. Sprint 6, 7 y 8 para robustez tecnica, wallets y seguridad.
7. Sprint 9 para preparar piloto.

## Fuera De Alcance Por Ahora

- mainnet;
- app mobile nativa;
- cumplimiento legal automatico multi-pais;
- IPFS para datos clinicos sin cifrado serio;
- publicar diagnosticos, documentos o examenes completos on-chain;
- convertir la medicina en un activo transferible.

## Supuestos

- se mantienen las rutas actuales;
- Firebase queda como DB inicial;
- Supabase queda como alternativa futura;
- Stellar Testnet es obligatorio para la demo verificable;
- los tres actores principales ven solo lo necesario;
- admin y `/mvp` concentran estado tecnico.
