# Flujo de demo grabable

Este documento ordena el recorrido del MVP para grabar pantalla sin improvisar.
La idea es mostrar que Trust Leaf no mezcla actores: paciente, medico,
dispensario y admin tienen rutas separadas, datos separados y permisos
distintos.

## Preparacion antes de grabar

1. Usa siempre el mismo navegador.
2. Manten el zoom en 100%.
3. Abre primero `http://127.0.0.1:3000/`.
4. Si vas a grabar produccion, usa `https://trustleaf.org/` o
   `https://trustleaf.vercel.app/`.
5. No borres `localStorage` antes de grabar si ya preparaste recetas, retiros o
   solicitudes demo.
6. Ten estas rutas listas:
   - Landing: `/`
   - Paciente: `/paciente`
   - Medico: `/medico`
   - Panel medico: `/medico/operacion`
   - Dispensario: `/dispensario`
   - Operacion dispensario: `/dispensario/operacion`
   - Admin: `/admin`

## Historia recomendada

### 1. Landing

URL: `/`

Mostrar:

- Trust Leaf como red privada y verificable.
- Tres ideas: privacidad clinica, receta verificable, medicina trazable.
- Accesos separados para pacientes, medicos, dispensarios y admin.

Mensaje breve:

> Trust Leaf separa lo que ve cada actor. El paciente controla su informacion,
> el medico valida tratamiento y el dispensario confirma solo lo necesario para
> entregar.

Click sugerido:

- `Portal Paciente`.

### 2. Paciente: identidad y control

URL: `/paciente`

Mostrar:

- El paciente entra solo.
- Tiene smart wallet/passkey/Freighter/demo testnet.
- Ve receta vigente, retiros, historial y accesos privados.

Mensaje breve:

> El paciente es el dueno de su ficha clinica. Puede entrar solo, revisar sus
> recetas, controlar retiros y compartir datos privados cuando lo decide.

Click sugerido:

- Abrir `Salud` para mostrar recetas.
- Abrir `Historial` para mostrar expediente privado, examenes y permisos 402.
- Volver a `Medicos` si quieres mostrar busqueda de doctor.

### 3. Medico: workspace de consulta

URL: `/medico/operacion`

Mostrar:

- Agenda del medico.
- Consulta activa o reservada.
- Acciones compactas: ficha privada, preparar receta, probar dispensario.

Mensaje breve:

> El medico no necesita navegar por diez pantallas. Desde su workspace ve la
> reserva, revisa los datos autorizados por el paciente y prepara una receta
> verificable.

Clicks sugeridos:

1. En un bloque reservado, click `Consulta`.
2. Click `Ficha privada` para mostrar consentimiento.
3. Cerrar popup.
4. Click `Preparar receta`.
5. Ver que la wallet del paciente queda bloqueada si viene desde consulta.
6. Click `Generar receta demo` o `Emitir en testnet`, segun ambiente.

Mensaje al emitir:

> La receta queda asociada al paciente y al medico. El detalle clinico completo
> permanece privado; la red registra prueba, vigencia y estado verificable.

### 4. Paciente: receta recibida

URL: `/paciente`

Mostrar:

- Click `Salud`.
- Abrir la receta emitida.
- Mostrar detalle de receta y validacion digital.

Mensaje breve:

> El paciente recibe la receta en su cuenta. Puede presentarla al dispensario
> sin entregar toda su historia clinica.

### 5. Dispensario: inventario y retiro parcial

URL: `/dispensario/operacion`

Mostrar:

- Inventario cargado por producto, lote, THC/CBD, origen y stock.
- Boton `Preparar dispensa`.
- Receta detectada automaticamente.
- Cupo mensual, gramos disponibles y gramos de este retiro.

Clicks sugeridos:

1. Click `Preparar dispensa` en un producto.
2. Revisar `Receta on-chain detectada`.
3. Click `Registrar retiro demo` o `Validar cupo y registrar retiro`.
4. Mostrar `Retiro registrado`.

Mensaje breve:

> El dispensario no ve diagnostico completo. Solo valida receta, vigencia, saldo
> disponible, lote y cantidad. Cada entrega puede ser parcial, por ejemplo 1g de
> 30g autorizados.

### 6. Paciente: retiro y trazabilidad

URL: `/paciente`

Mostrar:

- Click `Retiros Activos`.
- Mostrar token de retiro.
- Mostrar saldo actualizado: autorizado, retirado y disponible.
- Click `Historial` si quieres mostrar trazabilidad.

Mensaje breve:

> El paciente conserva visibilidad del saldo de receta y los retiros. La red
> mantiene trazabilidad sin publicar informacion medica sensible.

### 7. Admin: control de red

URL: `/admin`

Mostrar:

- Solicitudes de medicos.
- Solicitudes de dispensarios.
- Actores live o alta manual demo.
- Agentes 402 como validadores privados.

Mensaje breve:

> Medicos y dispensarios no entran libremente. Admin revisa, aprueba y luego el
> sistema prepara el alta on-chain en los registros correspondientes.

## Orden de grabacion de 60 segundos

1. 0-8s: Landing y problema.
2. 8-18s: Paciente controla identidad, receta e historial.
3. 18-32s: Medico abre consulta y emite receta.
4. 32-45s: Dispensario valida receta y registra retiro parcial.
5. 45-54s: Paciente ve retiro, saldo y trazabilidad.
6. 54-60s: Admin/red + CTA.

## Checklist antes de publicar video

- La fecha del calendario medico se ve actual.
- La receta aparece en paciente despues de emitir.
- La receta detectada en dispensario coincide con la ultima emitida.
- El retiro baja stock del dispensario.
- El paciente ve saldo dinamico de receta.
- No se muestra diagnostico completo al dispensario.
- No hay textos con encoding roto o sin acentos visibles en camara.
- Se menciona que el MVP usa Stellar Testnet y que contratos robustos, DB segura
  y passkeys completas son parte del siguiente financiamiento.
