# Full Editor

Un editor de documentos WYSIWYG hecho desde cero en React + TypeScript, con backend en FastAPI y PostgreSQL. Sin `contentEditable` — toda la edición se maneja con un textarea oculto y eventos JS.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, TypeScript 6, Zustand 5 |
| Build | Vite 8, Oxlint |
| Backend | FastAPI, SQLAlchemy 2, Alembic, PostgreSQL |
| PDF | ReportLab |
| Infra | Docker (PostgreSQL) |

## Arranque rápido

### Backend

```bash
cd backend

# Crear entorno virtual e instalar dependencias
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configurar BD (ajustar .env si es necesario)
# Debe haber un contenedor PostgreSQL corriendo en localhost:5432

# Ejecutar migraciones
alembic upgrade head

# Iniciar servidor
python main.py
# → http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Scripts

### Frontend

| Comando | Descripción |
|---------|------------|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Type-check + build producción |
| `npm run lint` | Linting con Oxlint |
| `npm run preview` | Preview del build |

### Backend

| Comando | Descripción |
|---------|------------|
| `python main.py` | Iniciar servidor (uvicorn, reload on) |
| `alembic upgrade head` | Ejecutar migraciones |
| `alembic revision --autogenerate -m "msg"` | Crear migración |

## API

Base: `http://localhost:8000`

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/documents/` | Listar documentos |
| `POST` | `/api/documents/` | Crear documento |
| `GET` | `/api/documents/{id}` | Obtener documento |
| `PUT` | `/api/documents/{id}` | Actualizar documento |
| `DELETE` | `/api/documents/{id}` | Eliminar documento |
| `POST` | `/api/export/pdf` | Exportar a PDF |

## Funcionalidades

### Edición de texto
- Inserción/borrado con batching de history (Ctrl+Z undo, Ctrl+Shift+Z redo)
- Split/merge de bloques (Enter / Backspace al inicio)
- Navegación con Arrow Keys (visual up/down vía Caret API)
- Home / End por línea
- Ctrl+A seleccionar todo

### Formato
- **Marks**: bold (Ctrl+B), italic (Ctrl+I), underline (Ctrl+U), strikethrough
- **Font family**: Georgia, Times New Roman, Arial, Helvetica, Verdana, Courier New, monospace
- **Font size**: 10–72px
- **Color**: selector de color
- **Alineación**: left, center, right
- **Clear formatting** de la selección

### Bloques
- Paragraph (base)
- Heading H1–H6
- Listas ordenadas y desordenadas (anidables)
- Blockquote
- Horizontal Rule
- Imagen con resize handles (8 direcciones, mantiene aspect ratio)
- Tabla con CRUD de filas/columnas y merge de celdas (colSpan/rowSpan)

### Persistencia
- CRUD completo vía API REST + PostgreSQL
- Save manual con dirty indicator
- Exportación a PDF con estilos, listas, tablas e imágenes

## Arquitectura

El frontend sigue una arquitectura por capas: **Estado → Operaciones → Layout → Renderizado**.

```
App
├── DocumentManager (listado de documentos)
└── Editor
    ├── Toolbar (formato, guardado, exportación PDF)
    ├── DocumentView (renderizado paginado con virtual scroll)
    │   └── PageRenderer
    │       ├── Paragraph / Heading
    │       ├── ListBlock
    │       ├── BlockquoteBlock
    │       ├── ImageBlock
    │       ├── TableBlock
    │       └── HorizontalRuleBlock
    ├── SelectionOverlay
    └── hidden <textarea> (captura de teclado)
```

### Stores (Zustand)

| Store | Responsabilidad |
|-------|----------------|
| `document-store` | Documento, historial de operaciones, undo/redo |
| `editor-store` | Cursor, selección |
| `layout-store` | LayoutEngine (medición de texto con Canvas API) |
| `page-store` | PaginationEngine (bloques → páginas) |

### Core

| Módulo | Descripción |
|--------|-------------|
| `types.ts` | Modelo de datos completo (18 tipos de operaciones) |
| `document.ts` | Constructores de nodos + tree traversal |
| `operations.ts` | Apply/invert para cada operación (Command Pattern) |
| `cursor.ts` | Movimiento lógico del cursor |
| `selection.ts` | Helpers de selección + deleteSelection |
| `interaction.ts` | Mapeo coordenadas de pantalla ↔ posición lógica |
| `layout/` | Engine de layout con medición Canvas |
| `pagination/` | Engine de paginación (A4, Letter, Legal) |

### Principios de diseño

- **Sin contentEditable**: la edición se maneja con un textarea oculto + eventos JS. La selección con mouse usa `caretPositionFromPoint` y handlers propios.
- **Inmutabilidad**: el documento se clona antes de mutar (`JSON.parse(JSON.stringify())`).
- **Operaciones como datos**: cada acción es un objeto `Operation` con `apply()` e `invert()` para undo/redo.
- **Layout medido con Canvas API**: `measureText()` con caché para evitar reflows del DOM.
- **Virtual scrolling**: solo se renderizan las páginas visibles.
- **Cursor pixel-perfect**: posicionado via Range API post-render.

### Documentos de arquitectura

Ver [`docs/architecture/`](docs/architecture/) para documentación detallada de cada subsistema.

## Project Status

- **Fase**: funcional, en desarrollo activo
- **Backend**: CRUD completo + exportación PDF
- **Frontend**: editor funcional con undo/redo, formato, bloques múltiples, paginación
- **Pendientes**: tests, auto-save, multi-usuario, plugins

---

*Mantenido con [SDD](https://github.com/gentle-ai/sdd) — Spec-Driven Development.*
