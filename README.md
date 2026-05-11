# APTKI Workstation — CFO Toolkit

APTKI Workstation es una Single Page Application (SPA) avanzada diseñada para automatizar y estandarizar el proceso de consultoría financiera y dirección financiera externalizada (CFO as a Service). 

Esta herramienta permite a los consultores ingerir libros diarios contables (PGC Español), limpiarlos, categorizarlos analíticamente y obtener instantáneamente cuadros de mando, previsiones a 12 meses y validaciones de elegibilidad para programas de financiación pública (ENISA, CDTI Neotec).

## 🚀 Arquitectura y Flujo de Trabajo (4 Pasos)

La aplicación sigue un flujo lineal e inmutable para garantizar la integridad de los datos financieros:

1. **Ingesta y Parseo:** Lee un archivo `.xlsx` (Libro Diario). El motor extrae asientos, identifica meses, y detecta anomalías contables básicas (descuadres, ausencias de amortizaciones).
2. **Reclasificación (Mapeo Humano):** El motor asigna las cuentas del grupo 6 y 7 a categorías de negocio (SaaS, Industrial, etc.) de forma inteligente. El consultor puede sobrescribir estas reglas manualmente.
3. **Periodificaciones (Accrual Engine):** Detecta picos de gasto anormales (ej. seguros anuales) y propone prorratearlos a lo largo de los meses activos para normalizar el EBITDA.
4. **Dashboard y Diagnóstico:** Se consolida el análisis. Se calculan KPIs universales y específicos por perfil de negocio, PyG analítica, y alertas de *burn rate*.

## 🧩 Módulos Adicionales (Fase 2 y 3)

* **🏅 Scoring Público:** Motor de reglas que cruza la situación patrimonial y la cuenta de resultados con los requisitos técnicos de ENISA Emprendedores y CDTI Neotec.
* **📈 Forecaster 12M:** Proyección financiera mes a mes utilizando el baseline histórico. Genera tres escenarios (Base, Optimista, Pesimista) de evolución de caja.
* **✅ Filtro Día 1:** Checklist interno de calidad del consultor. Se autocompleta parcialmente validando los outputs técnicos.
* **💾 Gestor de Sesiones:** Permite guardar y cargar el estado completo del análisis (`.aptki`) sin requerir backend.
* **📊 Exportador Financiero:** Motor que traduce el análisis a un libro Excel vivo (con fórmulas) y exportador PDF para presentaciones directas a comités.

## 🛠 Stack Tecnológico

* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS Nativo.
* **Diseño:** Sistema de diseño personalizado, Glassmorphism, CSS Variables, SVG Nativo para gráficos de alta performance.
* **Librerías externas (vía CDN):**
  * `SheetJS (xlsx)`: Para parsear e ingestar el libro diario de entrada, y exportar modelos vivos.
  * `html2pdf.js`: Generación robusta de reportes PDF ejecutivos a partir del DOM.

## 📦 Uso y Despliegue

La aplicación es 100% *Client-Side*. No requiere base de datos, backend ni instalación de dependencias en el servidor. La privacidad de los datos es total, ya que la información del cliente nunca abandona el navegador.

1. Abre `index.html` en cualquier navegador moderno.
2. Arrastra el Libro Diario de tu cliente (exportado de A3, Holded, Sage, etc.).
3. Sigue los pasos de mapeo y genera tu análisis.

## ⚖️ Licencia

Proyecto interno de APTKI. Todos los derechos reservados.
