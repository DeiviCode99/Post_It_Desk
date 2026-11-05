# Postit Desk

Notas tipo post-it que viven en el borde derecho de la pantalla. Ocultas son una
franja delgada; al pasar el mouse se despliega el panel con tus tareas y, al hacer
clic en una, la nota se abre como una hoja de papel a la izquierda.

- Prioridad = color del post-it (alta rosa, media amarilla, baja menta).
- Fecha límite, recordatorio con notificación de Windows, checklist y etiquetas.
- Autoguardado: no hay botón "Guardar".
- Arranca con Windows (versión instalada) y vive en la bandeja del sistema.

## Requisitos

- Windows 10/11
- Node.js 20 o superior (`node -v`)

## Instalación y desarrollo

Desde una terminal en esta carpeta:

```bash
npm run install:all   # instala backend y app de escritorio
npm test              # pruebas del backend (Jest)
npm run dev           # compila el backend y abre la app en modo desarrollo
```

En modo desarrollo la pestaña aparece en el borde derecho de la pantalla que está más a la derecha.
Para depurar el backend por separado:

```bash
cd apps/backend && npm run start:dev        # backend en http://127.0.0.1:4317/api
# en otra terminal (PowerShell):
$env:BACKEND_EXTERNAL="1"; npm run dev --prefix apps/desktop
```

## Crear el instalador

```bash
npm run dist
```

Genera `apps/desktop/release/Postit Desk Setup x.y.z.exe`. El backend se empaqueta
solo con sus dependencias de producción (`scripts/stage-backend.mjs`) y se copia
dentro de la app con el hook `scripts/after-pack.cjs`.

Si la app no arranca, el mensaje de error muestra las últimas líneas del backend.
El registro completo queda en `%APPDATA%\Postit Desk\logs\backend.log`. Al instalarla, la app se
registra para iniciar con Windows (se puede desactivar desde el icono de la bandeja).

## Uso

| Acción | Cómo |
| --- | --- |
| Mostrar el panel | Acercar el mouse a la franja del borde derecho, o `Ctrl+Alt+N` |
| Abrir una nota | Clic en su pestaña |
| Cerrar la nota | `Esc` o el botón × |
| Mantener visible | Botón de chincheta en el panel |
| Nueva tarea | Escribir en "Añadir tarea" y pulsar Enter, o "Nueva nota" en la bandeja |
| Elegir monitor | Bandeja > Pantalla. En automático usa la pantalla de más a la derecha |

Las notas se guardan en `%APPDATA%\Postit Desk\postit-desk.sqlite`.

## Arquitectura

Monolito modular: un backend y un frontend separados que se distribuyen juntos.

```
apps/
├── backend/   NestJS + TypeORM + SQLite (sql.js)
│   └── src/
│       ├── config/       AppConfig: puerto, token y ruta de la base
│       ├── common/       BaseEntity, guard de token, decorador @Public
│       ├── database/     conexión y migraciones
│       └── modules/
│           ├── notes/      entidades Note y ChecklistItem, DTOs, servicio, controlador
│           ├── tags/       etiquetas
│           ├── reminders/  qué recordatorios tocan y marcarlos como avisados
│           └── health/     chequeo de disponibilidad
└── desktop/   Electron + React + TypeScript
    └── src/
        ├── main/         proceso principal (clases con una responsabilidad cada una)
        │   ├── backend/    EmbeddedBackend (carga NestJS), ApiClient
        │   ├── window/     EdgeWindowManager (ventana lateral y sus estados)
        │   ├── reminders/  ReminderNotifier (notificaciones de Windows)
        │   ├── system/     AutoLaunch, TrayController, SettingsStore
        │   └── ipc/        handlers validados para el renderer
        ├── preload/      puente seguro (contextBridge) hacia React
        ├── shared/       contrato IPC compartido
        └── renderer/     interfaz React (componentes, hooks, estilos)
```

**Flujo:** Electron busca un puerto libre, genera un token aleatorio y arranca el
backend con `startServer()` (`apps/backend/src/server.ts`) dentro de su proceso
principal. El backend solo escucha en `127.0.0.1` y exige el token en cada petición
(`x-api-token`). React obtiene la URL y el token por IPC y habla con la API REST.
El backend también corre solo con `npm start` en `apps/backend`.

**Por qué no es un proceso aparte:** en la app instalada en Windows, los procesos
hijos de Electron (`utilityProcess` y `spawn` con `ELECTRON_RUN_AS_NODE`) quedaban
bloqueados antes de ejecutar código, mientras que el mismo backend arrancaba en ~2 s
fuera de la app. Ejecutarlo dentro del proceso principal evita el problema y mantiene
la separación por API HTTP.

**Decisiones:**

- **sql.js en vez de better-sqlite3:** evita compilar módulos nativos en Windows
  y recompilarlos para Electron. Para el volumen de una app de notas el rendimiento
  sobra.
- **Migraciones en lugar de `synchronize`:** el esquema cambia de forma controlada
  y no se pierden datos al actualizar entidades. Para un cambio de esquema, crea una
  nueva clase en `database/migrations` y regístrala en `MIGRATIONS`.
- **Recordatorios en dos partes:** el backend decide *qué* notificar (lógica de
  negocio, con pruebas); Electron solo *muestra* la notificación.

## API

Base: `http://127.0.0.1:<puerto>/api`

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/health` | Disponibilidad (sin token) |
| GET / POST | `/notes` | Listar (ordenadas) / crear |
| GET / PATCH / DELETE | `/notes/:id` | Ver / editar parcialmente / borrar |
| GET / POST | `/tags` | Listar / crear etiquetas |
| PATCH / DELETE | `/tags/:id` | Editar / borrar etiqueta |
| GET | `/reminders/due` | Recordatorios vencidos sin avisar |
| POST | `/reminders/:id/ack` | Marcar recordatorio como avisado |
