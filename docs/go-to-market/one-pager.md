# Trust Leaf

## Red privada y verificable para cannabis medicinal

Trust Leaf esta construyendo infraestructura para que pacientes, medicos,
dispensarios y administradores puedan operar cannabis medicinal con privacidad,
recetas verificables y trazabilidad por lote.

El paciente mantiene el control de su informacion clinica. La red solo verifica
lo necesario: identidad, receta vigente, cantidad autorizada, actor autorizado y
registro de entrega.

## Mision

Garantizar que los pacientes puedan acceder a cannabis medicinal de forma
segura, continua y verificable, manteniendo el control de su informacion
clinica. Trust Leaf conecta pacientes, medicos, dispensarios y administradores
para validar lo necesario sin exponer datos sensibles de mas.

## Vision

Convertir Trust Leaf en la red de confianza para cannabis medicinal y salud
regulada: interoperable entre paises, wallets, clinicas, dispensarios, marcas y
futuras blockchains.

## Problema

El cannabis medicinal esta creciendo, pero la experiencia sigue fragmentada:

- recetas dificiles de validar;
- pacientes que repiten su historial clinico una y otra vez;
- dispensarios que no saben con claridad que pueden entregar;
- poca trazabilidad del producto, lote y origen;
- informacion medica sensible expuesta de mas para poder demostrar validez;
- falta de infraestructura para operar entre jurisdicciones.

## Solucion

Trust Leaf separa la experiencia por actor:

- **Paciente:** crea su identidad, revisa medicos, recibe recetas, conserva
  historial privado, sube examenes y comparte acceso temporal cuando lo decide.
- **Medico:** solicita alta, administra pacientes, revisa evidencia autorizada
  y emite recetas verificables.
- **Dispensario:** solicita alta, carga inventario, valida receta vigente,
  registra entregas parciales y deja trazabilidad de lote.
- **Admin:** revisa licencias, aprueba medicos y dispensarios, y mantiene la red
  de actores confiables.

Stellar/Soroban se usa como capa de prueba verificable. Los agentes 402 validan
informacion sensible sin revelar documentos completos.

## Mercado inicial

Primer foco: LATAM regulado, con Chile, Argentina y Uruguay como narrativa
inicial de pilotos.

La oportunidad no es solo vender cannabis medicinal. La oportunidad es crear la
infraestructura de confianza para que pacientes, medicos, dispensarios, marcas y
reguladores puedan operar con datos privados y verificables.

## Modelo de negocio

Modelo hibrido:

- pilotos pagados, grants y licencias de implementacion en etapa inicial;
- SaaS/red B2B para dispensarios, clinicas y operadores regulados;
- fee por validacion, receta emitida o entrega registrada como
  **network/compliance fee**;
- acceso gratuito o freemium para pacientes, reduciendo friccion de adopcion.

## Traccion

Trust Leaf ya cuenta con un MVP funcional en produccion:

- landing publica en `trustleaf.org`;
- portal paciente;
- portal medico;
- portal dispensario;
- panel admin;
- flujo de solicitud y aprobacion de actores;
- receta verificable en testnet;
- entregas parciales simuladas;
- historial clinico privado;
- examenes y documentos del paciente;
- trazabilidad de medicina;
- integracion conceptual con passkeys, Freighter, Stellar y agentes 402.

## Roadmap

1. Convertir el MVP en piloto con actores reales.
2. Migrar persistencia a base de datos segura.
3. Fortalecer smart contracts para cupos parciales y saldo por receta.
4. Integrar passkeys/smart wallets para pacientes.
5. Reemplazar firmas custodiales testnet por firmas wallet/passkey de cada actor.
6. Ejecutar pilotos con medicos, dispensarios y marcas cannabicas.
7. Preparar expansion jurisdiccional e interoperabilidad multi-chain.

## Buscamos

Capital, grants y aliados estrategicos para convertir el MVP en infraestructura
real: smart contracts robustos, seguridad, base de datos privada, integracion
wallet/passkeys y pilotos operativos con actores del ecosistema cannabis
medicinal.
