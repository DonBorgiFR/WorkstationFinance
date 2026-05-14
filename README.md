# APTKI Workstation — CFO Toolkit

Herramienta profesional de análisis financiero para consultores senior APTKI. Ingesta libros diarios contables (PGC español), los clasifica analíticamente y genera dashboards, previsiones a 12 meses y scoring de elegibilidad para financiación pública.

## Flujo de Trabajo (4 Pasos)

```
Excel (.xlsx) → Parser → Mapeo → Devengos → Dashboard
```

1. **Ingesta y Parseo** — Lee libro diario, extrae asientos, detecta anomalías contables (descuadres, duplicados, cifras redondas, domingos).
2. **Reclasificación** — Asigna cuentas 6xx/7xx a categorías de negocio. El consultor puede sobrescribir.
3. **Periodificaciones** — Detecta picos de gasto anormales y propone prorratearlos para normalizar EBITDA.
4. **Dashboard** — KPIs, PyG analítica, cascada de rentabilidad, narrativa automática.

## Módulos

| Módulo | Archivo | Función |
|--------|---------|---------|
| Store | `store.js` | Motor de Estado Global Reactivo (Deep Proxy) y Pub/Sub |
| Parser | `parser.js` | Ingesta Excel, corrección época, saneamiento contable |
| Analyzer | `analyzer.js` | Motor de reglas declarativo, Trust Score, ebitdaSuspect |
| Profiles | `profiles.js` | Perfiles sectoriales (SaaS, Industrial, Servicios) y KPIs |
| Scorer | `scorer.js` | Scoring ENISA Emprendedores / CDTI Neotec |
| Forecaster | `forecaster.js` | Proyección 12M con tres escenarios |
| Narrative | `narrative.js` | Generación automática de texto analítico |
| Checklist | `checklist.js` | Framework "Filtro Día 1" con auto-completado |
| Exporter | `exporter.js` | Excel con fórmulas vivas + PDF con portada |
| Session | `session.js` | Persistencia .aptki con Audit Trail |
| Knowledge | `knowledge.js` | Guía de financiación pública/privada |
| App | `app.js` | Controlador SPA, renderizado, Audit Trail, hallazgos accionables |

## Características Clave

- **Trust Score** — Métrica 0–100 que evalúa la fiabilidad del libro cargado.
- **Motor de Anomalías Declarativo** — 7 reglas independientes y extensibles (`ANOMALY_RULES`).
- **Bloqueo por anomalías críticas** — Impide generar dashboard si hay asientos desbalanceados.
- **ebitdaSuspect** — Flag automático si ≥3 anomalías graves; marca EBITDA en rojo con disclaimer.
- **Audit Trail** — Registro cronológico de cada acción del pipeline, persistido en sesiones.
- **Hallazgos Accionables** — Tabla con hallazgo/impacto/severidad/recomendación/acción para CFOs.
- **Portada PDF** — Primera página profesional con Trust Score, anomalías y metadata.
- **Biblioteca de Reglas** — Panel visible en Checklist que lista todas las reglas activas.

## Stack

- **Frontend:** Vanilla JS (ES6+), HTML5, CSS nativo.
- **Diseño:** Dark Glassmorphism (blur, gradientes, bordes sutiles).
- **Reactividad:** ES6 Proxies nativos y patrón Observer (sin librerías).
- **Gráficos:** SVG nativo (cascada de rentabilidad, forecast).
- **CDN:** SheetJS (xlsx), html2pdf.js.
- **Backend:** Ninguno. 100% client-side. Los datos nunca salen del navegador.

## Documentación

- `DATA_CONTRACT.md` — Contrato de datos entre módulos (payload exacto, invariantes).
- `ARCHITECTURE.md` — Flujo de datos y responsabilidades por módulo.
- `.agent/skills/aptki-excel-parser/` — Reglas de comportamiento del parser para agentes.

## Uso

```
1. Abrir index.html en cualquier navegador moderno
2. Arrastrar o seleccionar libro diario (.xlsx)
3. Seguir los 4 pasos del pipeline
```

## Licencia

Proyecto interno de APTKI. Todos los derechos reservados.
