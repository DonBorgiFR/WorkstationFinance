# Plan de Implementación Fase 6: Sentido de Negocio Avanzado

## 1. Modificaciones en `checklist.js` (Filtro Día 1 Dinámico)
Actualmente, `CHECKLIST_DATA` es una constante estática. Para hacerla dinámica por arquetipo, se refactorizará a una función constructora `getChecklistData(profileId)`.

### Cambios exactos:
- Reemplazar `const CHECKLIST_DATA = [...]` por `function getChecklistData(profileId) { ... }`.
- Las categorías 1 a 4 se mantendrán universales.
- La categoría 5 (`negocio`) tendrá items dinámicos:
  - **SaaS (`profileId === 'saas'`):**
    - `nb_saas1`: "¿Se ha calculado correctamente el MRR y el Burn Multiple?"
    - `nb_saas2`: "¿Los costes de servidores (AWS, GCP) están clasificados en COGS?"
  - **Industrial / Servicios (`profileId === 'industrial'` o `servicios`):**
    - `nb_ind1`: "¿Existe separación contable clara para proyectos de I+D (fundamental para CDTI)?"
    - `nb_ind2`: "¿Se han identificado correctamente las partidas de CAPEX vs OPEX?"
- Se actualizarán las funciones `computeScore` y `renderChecklist` para invocar `getChecklistData(STATE.selectedProfile?.id)`.

## 2. Modificaciones en `analyzer.js` (Alertas Anti-Rechazo y Bankability)
Se añadirán tres nuevas reglas al motor de anomalías (`ANOMALY_RULES`) en `analyzer.js`. Estas reglas se evaluarán automáticamente y alimentarán el Dashboard.

### A. Alertas Anti-Rechazo (Due Diligence ENISA)
Se crearán dos reglas con severidad `high` (críticas para la financiación pública):
- **Regla `prestamos_socios` (Grupo 55):**
  - **Lógica:** Calcular el saldo de cuentas que empiezan por `55`.
  - **Alerta:** Si el saldo deudor supera un umbral (ej. 10.000€), disparar alerta `high` "Préstamos encubiertos a socios".
  - **Impacto:** Riesgo alto de rechazo en ENISA por fuga de capital.

- **Regla `deuda_publica_alta` (Grupo 47):**
  - **Lógica:** Evaluar los saldos de Hacienda Pública y Seguridad Social (cuentas `475`, `476`).
  - **Alerta:** Si los saldos acreedores representan un porcentaje elevado de los ingresos o la tesorería disponible, disparar alerta `high` "Deuda pública elevada".
  - **Impacto:** Bloqueo de certificación de estar al corriente de pagos para solicitar ayudas públicas.

### B. Bankability (Stack Financiero)
Se creará una regla o finding estratégico para la fase Scaleup:
- **Regla `bankability_scaleup`:**
  - **Lógica:** Si `pygMensual` revela ingresos anualizados o totales > 500.000€.
  - **Alerta:** Disparar un hallazgo "Fase Scaleup - Optimización de Stack Financiero".
  - **Recomendación (Narrativa):** Sugerir la migración a banca especializada en innovación (BBVA Spark, CaixaBank DayOne) combinada con neobancos ágiles (Qonto, Revolut Business) para diversificar riesgo y abaratar la operativa transaccional.

## 3. Conexión con la UI (Flujo y Visualización)
Para que estos chequeos dinámicos se integren sin romper la arquitectura:
- **UI del Checklist:** Al cambiar `CHECKLIST_DATA` por `getChecklistData()`, cada vez que se invoque `renderChecklist()` en `app.js` (al cambiar de perfil o al cargar un libro), el DOM se repintará con las preguntas correctas para ese arquetipo. Los auto-checks (`applyAutoChecks`) se adaptarán para marcar automáticamente `nb_saas2` si no hay servicios generales extraños, etc.
- **UI de Hallazgos Accionables:** Las nuevas reglas inyectadas en `ANOMALY_RULES` tendrán severidad `high` (para las alertas de ENISA), por lo que la función `renderActionableFindings` en `app.js` las recogerá automáticamente. Para la regla de *Bankability*, que es positiva, se le asignará una severidad `medium` o `info` (requerirá añadirla al mapa `FINDING_RECOMMENDATIONS` de `app.js` para renderizar el texto de impacto y acción correspondientes).
- **Inmutabilidad:** Todo el pipeline matemático se mantendrá intacto, ya que las anomalías son detectadas pasivamente y el score del checklist simplemente sumará el array dinámico devuelto por la fábrica.
