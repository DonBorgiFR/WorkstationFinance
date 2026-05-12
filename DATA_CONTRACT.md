# Contrato de Datos — APTKI Workstation

> Documento inmutable que define la estructura exacta de los payloads que fluyen entre módulos.
> Cualquier módulo que consuma `AnalysisResult` DEBE leer este documento.

---

## 1. `ParsedLedger` — Salida de `parser.js → parseLedgerFile()`

```javascript
{
  meta: {
    fileName: string,        // Nombre del archivo .xlsx cargado
    sheets: string[],        // Nombres de las hojas encontradas
    months: string[],        // Claves de mes ordenadas, ej. ["2026-01", "2026-02"]
    totalEntries: number,    // Total de filas parseadas
    totalCuentas: number     // Cuentas únicas detectadas
  },
  entries: Entry[],          // Array de asientos normalizados
  byMonth: { [monthKey: string]: Entry[] },
  anomalies: Anomaly[]      // Anomalías detectadas por el parser (nivel 1)
}
```

### `Entry`
```javascript
{
  sheet: string,             // Nombre de la hoja de origen
  monthKey: string,          // "YYYY-MM"
  fecha: string | null,      // ISO date "YYYY-MM-DD" o null
  asiento: string,           // Número o código del asiento
  cuenta: string,            // Código PGC (ej. "700000")
  grupo: string,             // Primer dígito (ej. "7")
  subgrupo: string,          // Dos primeros dígitos (ej. "70")
  descripcion: string,       // Texto libre del asiento
  debe: number,              // Importe en el Debe (0 si vacío)
  haber: number              // Importe en el Haber (0 si vacío)
}
```

### `Anomaly`
```javascript
{
  severity: 'critical' | 'high' | 'medium' | 'low',
  message: string,           // Título corto del hallazgo
  detail: string,            // Descripción técnica
  month?: string             // Mes afectado (opcional, solo parser-level)
}
```

---

## 2. `AnalysisResult` — Salida de `analyzer.js → analyzeLedger()`

```javascript
{
  meta: {
    ...ParsedLedger.meta,    // Se hereda todo del parser
    trustScore: number       // 0–100. Métrica maestra de fiabilidad del libro
  },
  totales: {
    ingresos: number,        // Σ totalIngresos de todos los meses
    gastos: number,          // Σ (cogs + personal + marketing + serviciosOp + tributos + amort + gtosFinancieros)
    ebitda: number,          // Σ ebitda mensual
    resultado: number,       // Σ resultadoNeto mensual
    cogs: number,            // Σ COGS
    cajaFinal: number,       // Saldo de tesorería (grupos 57x). Mínimo 0.
    burnRateNeto: number,    // (gastos - ingresos) / nMeses. 0 si rentable.
    gastosPorGrupo: { [subgrupo: string]: number },
    saldoCuenta: { [cuenta: string]: number },  // Saldo neto por cuenta (haber - debe)
    ebitdaSuspect: boolean   // true si ≥3 anomalías high/critical
  },
  balance: {
    activoNoCorriente: number,
    activoCorriente: number,
    patrimonioNeto: number,
    pasivoNoCorriente: number,
    pasivoCorriente: number,
    pasivoTotal: number
  },
  pygMensual: {
    [monthKey: string]: {
      ventas: number,
      otrosIngresos: number,
      totalIngresos: number,
      cogs: number,
      margenBruto: number,
      personal: number,
      marketing: number,
      serviciosOperativos: number,
      tributos: number,
      ebitda: number,
      amortizacion: number,
      ebit: number,
      gastosFinancieros: number,
      resultadoNeto: number
    }
  },
  byMonth: { [monthKey: string]: Entry[] },
  lastMonth: string,         // Último monthKey del periodo
  lastMonthEntries: Entry[], // Asientos del último mes (para MRR)
  categoryMap: { [cuenta: string]: string }  // Mapa final de clasificación usado
}
```

---

## 3. Consumidores

| Módulo | Campo(s) consumidos | Notas |
|--------|---------------------|-------|
| `app.js` (Dashboard) | `totales.*`, `pygMensual`, `meta.trustScore`, `totales.ebitdaSuspect` | Renderiza KPIs, PyG, Trust Score |
| `narrative.js` | `totales.ingresos`, `totales.gastos`, `totales.ebitda`, `totales.cajaFinal`, `totales.burnRateNeto`, `pygMensual` | Genera texto analítico |
| `scorer.js` | `totales.ingresos`, `totales.ebitda`, `totales.resultado`, `balance.*`, `totales.cajaFinal` | Scoring ENISA/CDTI |
| `forecaster.js` | `pygMensual`, `totales.ingresos`, `totales.gastos`, `lastMonth`, `lastMonthEntries` | Proyección 12M |
| `exporter.js` | Todo el `AnalysisResult` + `STATE.parsedLedger.anomalies` | Export Excel/PDF |
| `session.js` | `STATE.parsedLedger`, `STATE.analysisResult`, `STATE.auditTrail` | Persistencia .aptki |

---

## 4. Invariantes

- `totales.gastos` **siempre** incluye: `cogs + personal + marketing + serviciosOperativos + tributos + amortizacion + gastosFinancieros`.
- `totales.ebitda` **nunca** incluye amortización ni gastos financieros.
- `trustScore` se calcula **después** de ejecutar `runAnomalyEngine()`, por lo que refleja TODAS las anomalías (parser + analyzer).
- `ebitdaSuspect` es `true` cuando `count(severity ∈ {high, critical}) >= 3`.
- `balance` puede tener valores a 0 si el libro no contiene cuentas de balance (grupos 1-5).
