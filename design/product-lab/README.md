# Laboratorio de experiencia Trust Leaf

Prototipos A/B aislados. Misma informacion sintetica y mismas tareas.
No hay autenticacion, fetch, almacenamiento local ni escrituras. Los estados
se reinician al recargar. La barra LAB es de evaluacion, no parte del producto.

## Ejecutar desde la raiz del repositorio

```powershell
node node_modules/vite/bin/vite.js --config design/product-lab/vite.config.mjs
```

Abrir http://127.0.0.1:4330/. Vite solo escucha en loopback. El middleware
rechaza `/api/` y metodos de escritura. Sin conexion a Supabase/Privy/Resend.

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build --config design/product-lab/vite.config.mjs
# PLAYWRIGHT_MODULE puede apuntar a la instalacion local existente de Playwright.
node design/product-lab/qa.mjs
```

QA requiere Chrome instalado. Resultados y capturas locales en
`scratch/product-lab-evidence/`; build en `scratch/product-lab-build/`.
No modifica los comandos ni la entrada de la aplicacion productiva.

## Comparar

1. Elegir A o B y el rol.
2. Buscar P-104, seleccionar ALB-024 y preparar 5 g.
3. Revisar sin ejecutar; volver y comprobar el contexto.
4. Localizar NOR-018 y distinguir su cuarentena.
5. Abrir historial de ALB-024 y recuperar REC-001.
6. Comparar carga, error y vacio usando el selector Estado.

Anotar en cada alternativa si se completo sin ayuda, que informacion costo
encontrar y donde se perdio contexto. Preferencia y autonomia humana pendientes.
Los tests automatizados no las sustituyen.

Ver [mapa, recorridos y backlog](../../docs/PRODUCT_EXPERIENCE_MAP.md).
La preview anterior `58b2839` queda preservada y descartada; estos prototipos
no importan sus estilos. No publicar hasta elegir direccion y completar la
implementacion conectada por entregas separadas.
