# Activacion Privy + Supabase

## Objetivo

Privy autentica la persona y administra su wallet Stellar. Supabase conserva el
rol, el ciclo de aprobacion y los datos privados. Stellar Testnet conserva solo
pruebas verificables de actores, recetas, vigencia, saldo y retiros.

Un inicio de sesion exitoso no concede un rol automaticamente. El servidor
verifica el token de identidad de Privy y resuelve un vinculo privado entre el
DID de Privy y un actor de Trust Leaf.

## Antes De Activar

1. Aplicar `20260830100000_privy_identity_bindings.sql` en el proyecto Supabase.
2. Mantener Firebase como respaldo hasta que los cuatro roles pasen la prueba
   manual con Privy.
3. No subir ni pegar secretos en GitHub, archivos `VITE_*`, logs o chat.

## Configuracion Manual De Privy

En el panel de Privy:

1. Crear dos aplicaciones separadas: una para `staging` y otra para produccion.
2. Habilitar Google, email y passkeys como metodos de acceso. Google es la
   entrada rapida con una cuenta de correo; email OTP conserva una alternativa
   universal.
3. Habilitar el retorno de identity tokens en la seccion avanzada de
   autenticacion.
4. Registrar dominios autorizados. Produccion usa `https://www.trustleaf.org`
   y `https://trustleaf.org`; staging debe usar un subdominio estable antes de
   habilitar cookies HttpOnly.
5. Habilitar Stellar como extended chain segun la disponibilidad de la cuenta.

Luego cargar directamente en Vercel:

| Variable | Entorno | Visibilidad |
| --- | --- | --- |
| `VITE_PRIVY_APP_ID` | staging/production | publica de navegador |
| `VITE_PRIVY_CLIENT_ID` | staging/production | publica de navegador |
| `PRIVY_APP_ID` | staging/production | solo servidor |
| `PRIVY_APP_SECRET` | staging/production | solo servidor |
| `SUPABASE_SECRET_KEY` | staging/production | solo servidor |

El App Secret no debe copiarse a este repositorio ni a una variable `VITE_*`.

## Ceremonia De Rol Inicial

1. La persona inicia sesion con Privy.
2. El backend valida el identity token con `@privy-io/node`.
3. Un operador autorizado vincula el DID resultante a un actor de Supabase.
4. Solo entonces el actor puede acceder a su portal correspondiente.
5. El primer admin se vincula por una operacion controlada de servidor; nunca
   por un boton de auto-registro.

## Prueba De Aceptacion

1. Admin autenticado revisa y aprueba una solicitud de medico y dispensario.
2. Medico autenticado recibe/crea su wallet Stellar y entra a su workspace.
3. Paciente autenticado controla su ficha y reserva una consulta.
4. Dispensario autenticado valida una receta sin leer datos clinicos.
5. Revocar un vinculo o permiso bloquea el acceso de forma inmediata.

## Retiro De Firebase

Firebase se elimina solo despues de que la prueba de aceptacion pase en staging
y produccion. El retiro incluye dependencias, variables, rutas de login y
documentacion; no se hace durante la misma entrega que activa Privy.
