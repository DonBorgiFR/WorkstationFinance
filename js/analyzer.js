/**
 * analyzer.js — Motor de Análisis Financiero Genérico
 *
 * Toma un ParsedLedger y produce:
 *   totales    → cifras agregadas del periodo completo
 *   byMonth    → PyG analítica mensual
 *   balance    → Balance simplificado estimado
 *   kpis       → KPIs universales + KPIs del perfil seleccionado
 */

// Clasificación de categorías analíticas posibles
const CATEGORIAS_ANALITICAS = {
  ingresos_ventas: 'Ventas / Prestación de servicios',
  ingresos_otros: 'Otros ingresos',
  cogs: 'Coste de Ventas (COGS)',
  personal: 'Personal (Sueldos y SS)',
  servicios: 'Servicios Generales / Operativos',
  marketing: 'Marketing y publicidad',
  amortizacion: 'Amortización',
  gastos_financieros: 'Gastos financieros',
  tributos: 'Tributos e impuestos',
  ignorar: 'Ignorar / No imputable a PyG'
};

// Cuentas de tesorería y balance
const CUENTAS_TESORERIA = ['57','572','570','571'];
const CUENTAS_DEUDORES  = ['43','430','431'];
const CUENTAS_ACREEDORES= ['40','400','401'];
const CUENTAS_DEUDA_LP  = ['17','170','171','172'];
const CUENTAS_PN        = ['10','11','12','13','14'];

function matchesCuenta(cuenta, grupo) {
  return cuenta.startsWith(grupo);
}

function saldoCuenta(entries, prefijos) {
  // Saldo = Debe - Haber (para cuentas de activo) o Haber - Debe (pasivo)
  const filtered = entries.filter(e => prefijos.some(p => e.cuenta.startsWith(p)));
  const debe  = filtered.reduce((s, e) => s + e.debe, 0);
  const haber = filtered.reduce((s, e) => s + e.haber, 0);
  return { debe, haber, saldo: debe - haber };
}

/**
 * getDefaultMapping(cuentasUnicas, profileId)
 * Genera el mapeo automático basándose en el PGC.
 * Devuelve un objeto: { "7000001": "ingresos_ventas", ... }
 */
function getDefaultMapping(cuentasUnicas, profileId) {
  const map = {};
  for (const cta of cuentasUnicas) {
    if (cta.startsWith('70') || cta.startsWith('71') || cta.startsWith('72') || cta.startsWith('73') || cta.startsWith('74') || cta.startsWith('75')) {
      map[cta] = 'ingresos_ventas';
    } else if (cta.startsWith('76') || cta.startsWith('77') || cta.startsWith('79')) {
      map[cta] = 'ingresos_otros';
    } else if (cta.startsWith('60') || cta.startsWith('61')) {
      map[cta] = 'cogs';
    } else if (cta.startsWith('64')) {
      map[cta] = 'personal';
    } else if (cta.startsWith('627')) {
      map[cta] = 'marketing';
    } else if (cta.startsWith('62')) {
      // Regla SaaS: AWS, Pasarelas a COGS
      if (profileId === 'saas' && (cta.startsWith('626') || cta.startsWith('628') || cta.startsWith('629'))) {
        map[cta] = 'cogs';
      } else {
        map[cta] = 'servicios';
      }
    } else if (cta.startsWith('63')) {
      map[cta] = 'tributos';
    } else if (cta.startsWith('65')) {
      map[cta] = 'servicios';
    } else if (cta.startsWith('66')) {
      map[cta] = 'gastos_financieros';
    } else if (cta.startsWith('68')) {
      map[cta] = 'amortizacion';
    } else if (cta.startsWith('6') || cta.startsWith('7')) {
      map[cta] = 'ignorar'; // Por defecto si no encaja
    }
  }
  return map;
}

function sumByCategory(entries, categoryMap, targetCategory, isIngreso = false) {
  // Ingresos suman Haber - Debe. Gastos suman Debe - Haber.
  return entries.reduce((sum, e) => {
    if (categoryMap[e.cuenta] === targetCategory) {
      return sum + (isIngreso ? (e.haber - e.debe) : (e.debe - e.haber));
    }
    return sum;
  }, 0);
}

// ---- Motor de Devengo (Accrual Engine) ----
/**
 * detectAccrualCandidates(entries, categoryMap, months)
 * Busca cuentas de gasto operativo donde haya un único apunte que represente 
 * más del 80% del gasto anual de esa cuenta y supere un umbral.
 */
function detectAccrualCandidates(entries, categoryMap, months) {
  const candidates = [];
  const validCategories = ['servicios', 'marketing', 'cogs'];
  const nMeses = Math.max(months.length, 1);
  if (nMeses <= 1) return []; // No tiene sentido periodificar si solo hay 1 mes

  // Agrupar gastos por cuenta
  const gastosPorCuenta = {};
  for (const e of entries) {
    const cat = categoryMap[e.cuenta];
    if (validCategories.includes(cat) && e.debe > 0) {
      if (!gastosPorCuenta[e.cuenta]) gastosPorCuenta[e.cuenta] = { total: 0, apunteMayor: null };
      gastosPorCuenta[e.cuenta].total += e.debe;
      if (!gastosPorCuenta[e.cuenta].apunteMayor || e.debe > gastosPorCuenta[e.cuenta].apunteMayor.debe) {
        gastosPorCuenta[e.cuenta].apunteMayor = e;
      }
    }
  }

  for (const [cta, data] of Object.entries(gastosPorCuenta)) {
    if (data.total > 1500) { // Umbral mínimo para no molestar con recibos pequeños
      const pico = data.apunteMayor;
      if (pico.debe / data.total > 0.8) { // El pico es más del 80% del gasto de esa cuenta
        candidates.push({
          cuenta: cta,
          descripcion: pico.descripcion || 'Gasto no descrito',
          mesOrigen: pico.monthKey,
          importeTotal: pico.debe,
          mesesARepartir: nMeses,
          importeMensual: pico.debe / nMeses
        });
      }
    }
  }
  return candidates;
}

/**
 * applyAccruals(byMonth, approvedAccruals, months)
 * Aplica los devengos creando un byMonth clonado con ajustes virtuales.
 */
function applyAccruals(byMonth, approvedAccruals, months) {
  if (!approvedAccruals || approvedAccruals.length === 0) return byMonth;

  // Clonar la estructura byMonth para no mutar el original de forma destructiva
  const devengadoByMonth = {};
  for (const mk of months) {
    devengadoByMonth[mk] = byMonth[mk] ? [...byMonth[mk]] : [];
  }

  for (const acc of approvedAccruals) {
    // 1. Quitar el gasto del mes origen
    const mesOriginal = devengadoByMonth[acc.mesOrigen];
    if (mesOriginal) {
      mesOriginal.push({
        cuenta: acc.cuenta,
        grupo: acc.cuenta.charAt(0),
        descripcion: `[Ajuste Devengo] Extracción de ${acc.descripcion}`,
        debe: 0,
        haber: acc.importeTotal // Un abono (haber) contrarresta el gasto (debe) original
      });
    }

    // 2. Repartir el gasto entre todos los meses
    for (const mk of months) {
      if (!devengadoByMonth[mk]) devengadoByMonth[mk] = [];
      devengadoByMonth[mk].push({
        cuenta: acc.cuenta,
        grupo: acc.cuenta.charAt(0),
        descripcion: `[Ajuste Devengo] Prorrateo de ${acc.descripcion}`,
        debe: acc.importeMensual,
        haber: 0
      });
    }
  }

  return devengadoByMonth;
}

// ---- PyG mensual ----
function buildPyGMensual(byMonth, categoryMap) {
  const months = Object.keys(byMonth).sort();
  const rows = {};

  for (const mk of months) {
    const entries = byMonth[mk];

    const ventas       = sumByCategory(entries, categoryMap, 'ingresos_ventas', true);
    const otrosIng     = sumByCategory(entries, categoryMap, 'ingresos_otros', true);
    const totalIngresos = ventas + otrosIng;

    const cogs         = sumByCategory(entries, categoryMap, 'cogs', false);
    const margenBruto  = totalIngresos - cogs;
    
    const personal     = sumByCategory(entries, categoryMap, 'personal', false);
    const marketing    = sumByCategory(entries, categoryMap, 'marketing', false);
    const serviciosOp  = sumByCategory(entries, categoryMap, 'servicios', false);
    const tributos     = sumByCategory(entries, categoryMap, 'tributos', false);
    const amortizacion = sumByCategory(entries, categoryMap, 'amortizacion', false);
    const gastosFinancieros = sumByCategory(entries, categoryMap, 'gastos_financieros', false);

    const totalGastos  = cogs + personal + marketing + serviciosOp + tributos + amortizacion + gastosFinancieros;
    const ebitda       = totalIngresos - cogs - personal - marketing - serviciosOp - tributos;
    const ebit         = ebitda - amortizacion;
    const resultadoNeto = ebit - gastosFinancieros;

    // Caja de tesorería
    const caja = saldoCuenta(entries, CUENTAS_TESORERIA);

    rows[mk] = {
      ventas,
      otrosIngresos: otrosIng,
      totalIngresos,
      cogs,
      margenBruto,
      personal,
      marketing,
      serviciosOperativos: serviciosOp,
      tributos,
      ebitda,
      amortizacion,
      ebit,
      gastosFinancieros,
      resultadoNeto,
      cajaSaldo: caja.debe - caja.haber // tesorería: activo, saldo deudor
    };
  }

  return rows;
}

// ---- Balance simplificado ----
function buildBalanceEstimado(entries) {
  const tesoreria   = saldoCuenta(entries, CUENTAS_TESORERIA);
  const clientes    = saldoCuenta(entries, CUENTAS_DEUDORES);
  const proveedores = saldoCuenta(entries, CUENTAS_ACREEDORES);
  const deudaLP     = saldoCuenta(entries, CUENTAS_DEUDA_LP);
  const pn          = saldoCuenta(entries, CUENTAS_PN);
  const inmovilizado = saldoCuenta(entries, ['20','21','22','23']);

  const cajaFinal = Math.max(0, tesoreria.debe - tesoreria.haber);
  const activoCorriente = cajaFinal + Math.max(0, clientes.debe - clientes.haber);
  const activoNoCorriente = Math.max(0, inmovilizado.debe - inmovilizado.haber);
  const pasivoCorriente = Math.max(0, proveedores.haber - proveedores.debe);
  const pasivoNoCorriente = Math.max(0, deudaLP.haber - deudaLP.debe);
  const pasivoTotal = pasivoCorriente + pasivoNoCorriente;
  const patrimonioNeto = Math.max(1, pn.haber - pn.debe); // evitar div/0

  return {
    cajaFinal,
    activoCorriente,
    activoNoCorriente,
    activoTotal: activoCorriente + activoNoCorriente,
    pasivoCorriente,
    pasivoNoCorriente,
    pasivoTotal,
    patrimonioNeto
  };
}

// ---- Detección Analítica de Anomalías (Aptki Pro - Arquitectura Declarativa) ----
const ANOMALY_RULES = [
  {
    id: 'cifras_redondas',
    severity: 'medium',
    label: 'Alta concentración de cifras redondas',
    check: (entries, pygMensual, categoryMap) => {
      const roundEntries = entries.filter(e => 
        (e.debe > 0 && e.debe % 500 === 0) || 
        (e.haber > 0 && e.haber % 500 === 0)
      );
      if (entries.length > 0 && (roundEntries.length / entries.length > 0.15)) {
        return [{
          severity: 'medium', message: 'Alta concentración de cifras redondas',
          detail: `${roundEntries.length} asientos (${((roundEntries.length/entries.length)*100).toFixed(1)}%) son múltiplos exactos de 500€ o 1.000€`
        }];
      }
      return [];
    }
  },
  {
    id: 'facturas_domingo',
    severity: 'high',
    label: 'Facturas registradas en domingo',
    check: (entries, pygMensual, categoryMap) => {
      const sundayEntries = entries.filter(e => {
        if (!e.fecha) return false;
        let d;
        if (e.fecha.includes('/')) {
          const parts = e.fecha.split('/');
          if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          d = new Date(e.fecha);
        }
        return d && !isNaN(d.getTime()) && d.getDay() === 0;
      });
      if (sundayEntries.length > 0) {
        return [{
          severity: 'high', message: `${sundayEntries.length} asiento(s) registrados en domingo`,
          detail: sundayEntries.slice(0,3).map(e => `${e.fecha} · ${e.cuenta} · ${e.debe||e.haber}€`).join(' | ')
        }];
      }
      return [];
    }
  },
  {
    id: 'duplicados_exactos',
    severity: 'high',
    label: 'Posible registro duplicado',
    check: (entries, pygMensual, categoryMap) => {
      const anomalies = [];
      const seen = new Map();
      entries.forEach(e => {
        if ((e.debe === 0 && e.haber === 0) || !e.fecha) return;
        const key = `${e.fecha}_${e.cuenta}_${e.debe}_${e.haber}_${e.descripcion}`;
        if (seen.has(key)) {
          anomalies.push({ severity: 'high', message: `Posible duplicado detectado`,
            detail: `Cuenta ${e.cuenta} · ${e.debe||e.haber}€ · Fecha ${e.fecha} · ${e.descripcion}` });
        } else { seen.set(key, true); }
      });
      return anomalies;
    }
  },
  {
    id: 'margen_bruto_negativo',
    severity: 'high',
    label: 'Margen bruto negativo',
    check: (entries, pygMensual, categoryMap) => {
      const months = Object.keys(pygMensual).sort();
      const negMonths = months.filter(m => pygMensual[m]?.margenBruto < 0);
      if (negMonths.length >= 2) {
        return [{
          severity: 'high', message: `Margen bruto negativo en ${negMonths.length} meses`,
          detail: negMonths.join(', ')
        }];
      }
      return [];
    }
  },
  {
    id: 'cliente_unico',
    severity: 'high',
    label: 'Concentración de cliente único',
    check: (entries, pygMensual, categoryMap) => {
      const ingresosPorCuenta = {};
      let ingresosTotales = 0;
      entries.forEach(e => {
        if (categoryMap[e.cuenta] === 'ingresos_ventas' || categoryMap[e.cuenta] === 'ingresos_otros') {
          const val = e.haber - e.debe;
          if (val > 0) {
            ingresosPorCuenta[e.cuenta] = (ingresosPorCuenta[e.cuenta] || 0) + val;
            ingresosTotales += val;
          }
        }
      });
      const anomalies = [];
      if (ingresosTotales > 0) {
        for (const [cuenta, monto] of Object.entries(ingresosPorCuenta)) {
          if (monto / ingresosTotales > 0.70) {
            anomalies.push({ severity: 'high', message: 'Riesgo de Concentración de Cliente Único',
              detail: `La cuenta ${cuenta} concentra el ${((monto/ingresosTotales)*100).toFixed(1)}% de los ingresos totales.` });
          }
        }
      }
      return anomalies;
    }
  },
  {
    id: 'cuota_personal_critica',
    severity: 'high',
    label: 'Cuota de personal insostenible',
    check: (entries, pygMensual, categoryMap) => {
      const months = Object.keys(pygMensual).sort();
      let mesesAltaCuotaPersonal = 0;
      for (const mk of months) {
        const m = pygMensual[mk];
        if (m.totalIngresos > 0 && (m.personal / m.totalIngresos) > 0.8) {
          mesesAltaCuotaPersonal++;
        }
      }
      if (mesesAltaCuotaPersonal >= 3) {
        return [{
          severity: 'high', message: 'Escala insostenible: Cuota de personal crítica',
          detail: `Durante ${mesesAltaCuotaPersonal} meses el coste de personal superó el 80% de los ingresos.`
        }];
      }
      return [];
    }
  },
  {
    id: 'asiento_descuadrado',
    severity: 'critical',
    label: 'Asientos desbalanceados',
    check: (entries, pygMensual, categoryMap) => {
      const asientosMap = {};
      entries.forEach(e => {
        if (!e.asiento) return;
        if (!asientosMap[e.asiento]) asientosMap[e.asiento] = { debe: 0, haber: 0 };
        asientosMap[e.asiento].debe += e.debe || 0;
        asientosMap[e.asiento].haber += e.haber || 0;
      });
      let descuadresPorAsiento = 0;
      for (const [asiento, sumas] of Object.entries(asientosMap)) {
        if (Math.abs(sumas.debe - sumas.haber) > 0.02) {
          descuadresPorAsiento++;
        }
      }
      if (descuadresPorAsiento > 0) {
        return [{
          severity: 'critical', message: `Asientos desbalanceados detectados (Crítico)`,
          detail: `${descuadresPorAsiento} asientos individuales no cuadran (Debe != Haber). Invalida el libro mayor.`
        }];
      }
      return [];
    }
  }
];

function runAnomalyEngine(entries, pygMensual, categoryMap) {
  let allAnomalies = [];
  ANOMALY_RULES.forEach(rule => {
    try {
      const results = rule.check(entries, pygMensual, categoryMap);
      if (results && results.length > 0) {
        // Inyectamos el ID de la regla en el hallazgo para trazabilidad técnica (Fase 5 Hardening)
        allAnomalies.push(...results.map(r => ({ ...r, id: rule.id })));
      }
    } catch (e) {
      console.warn(`Error ejecutando regla de anomalía: ${rule.id}`, e);
    }
  });
  return allAnomalies;
}

// ---- Confidence Engine (centralizado — ningún consumidor debe recalcular) ----
const CONFIDENCE_LEVELS = {
  reliable:     { min: 80, label: 'Análisis fiable',              forecastMode: 'normal',       scoringPenalty: 0  },
  reservations: { min: 60, label: 'Utilizable con reservas',      forecastMode: 'cautious',     scoringPenalty: 5  },
  indicative:   { min: 40, label: 'Solo orientativo',             forecastMode: 'conservative', scoringPenalty: 15 },
  blocked:      { min: 0,  label: 'Diagnóstico únicamente',      forecastMode: 'simulation',   scoringPenalty: 25 }
};

/**
 * getConfidenceMeta(trustScore, anomalies, ebitdaSuspect)
 * Punto único de cálculo de confianza. Ningún otro módulo debe recalcular niveles.
 * @returns {{ trustScore, confidenceLevel, confidenceLabel, forecastMode, scoringPenalty, analysisLimitations, fundingReadinessFlags }}
 */
function getConfidenceMeta(trustScore, anomalies, ebitdaSuspect) {
  // Determinar nivel
  let confidenceLevel = 'blocked';
  for (const [level, cfg] of Object.entries(CONFIDENCE_LEVELS)) {
    if (trustScore >= cfg.min) { confidenceLevel = level; break; }
  }
  const cfg = CONFIDENCE_LEVELS[confidenceLevel];

  // Limitaciones derivadas automáticamente
  const analysisLimitations = [];
  const highCritical = anomalies.filter(a => a.severity === 'high' || a.severity === 'critical');
  if (highCritical.length > 0) {
    analysisLimitations.push(`${highCritical.length} anomalía(s) grave(s) detectada(s) en el libro contable.`);
  }
  if (ebitdaSuspect) {
    analysisLimitations.push('Las conclusiones de rentabilidad (EBITDA, márgenes) están condicionadas por incidencias relevantes.');
  }
  if (confidenceLevel === 'indicative' || confidenceLevel === 'blocked') {
    analysisLimitations.push('El análisis no es defensable sin revisión manual previa del libro diario.');
  }
  const hasDescuadre = anomalies.some(a => a.id === 'asiento_descuadrado' || a.id === 'descuadre_contable');
  if (hasDescuadre) {
    analysisLimitations.push('Existen descuadres contables que invalidan la integridad aritmética del libro.');
  }

  // Funding readiness flags
  const fundingReadinessFlags = {
    scoringDefensible:    confidenceLevel !== 'blocked',
    forecastDefensible:   confidenceLevel === 'reliable' || confidenceLevel === 'reservations',
    narrativeConclusive:  confidenceLevel === 'reliable',
    requiresManualReview: confidenceLevel === 'indicative' || confidenceLevel === 'blocked'
  };

  return {
    trustScore,
    confidenceLevel,
    confidenceLabel: cfg.label,
    forecastMode: cfg.forecastMode,
    scoringPenalty: cfg.scoringPenalty,
    ebitdaSuspect,
    analysisLimitations,
    fundingReadinessFlags
  };
}

// ---- Análisis completo ----
/**
 * analyzeLedger(parsedLedger, profileId, customMapping, approvedAccruals) → AnalysisResult
 */
function analyzeLedger(parsedLedger, profileId, customMapping = null, approvedAccruals = []) {
  const { entries, byMonth } = parsedLedger;
  const months = Object.keys(byMonth).sort();
  const nMeses = Math.max(months.length, 1);

  // Mapeo analítico
  const uniqueAccounts = new Set(entries.map(e => e.cuenta));
  const categoryMap = customMapping || getDefaultMapping(uniqueAccounts, profileId);

  // Aplicar devengos si los hay
  const byMonthDevengado = applyAccruals(byMonth, approvedAccruals, months);

  // PyG mensual (usamos el byMonthDevengado)
  const pygMensual = buildPyGMensual(byMonthDevengado, categoryMap);

  // Detección de Anomalías Analíticas (Aptki Pro)
  // INMUTABILIDAD: NO mutamos parsedLedger.anomalies. Combinamos en array nuevo.
  const analyzerAnomalies = runAnomalyEngine(entries, pygMensual, categoryMap);
  const parserIds = new Set(parsedLedger.anomalies.map(a => a.id));
  const deduplicatedNew = analyzerAnomalies.filter(na => !parserIds.has(na.id));
  const allAnomalies = [...parsedLedger.anomalies, ...deduplicatedNew];

  // Verificar si hay demasiadas anomalías graves para marcar el EBITDA como sospechoso
  const highOrCriticalCount = allAnomalies.filter(a => a.severity === 'high' || a.severity === 'critical').length;
  const ebitdaSuspect = highOrCriticalCount >= 3;
  
  if (ebitdaSuspect) {
    // Si ya existe una anomalía de EBITDA Sospechoso por reglas previas, no la duplicamos
    if (!allAnomalies.some(a => a.id === 'ebitda_suspect')) {
      allAnomalies.push({
        id: 'ebitda_suspect',
        severity: 'high',
        message: 'Integridad del EBITDA comprometida',
        detail: 'El elevado número de anomalías graves detectadas resta fiabilidad a la métrica de EBITDA.'
      });
    }
  }

  // Totales del periodo
  const totalIngresos = Object.values(pygMensual).reduce((s, m) => s + m.totalIngresos, 0);
  const totalGastos   = Object.values(pygMensual).reduce((s, m) =>
    s + m.cogs + m.personal + m.marketing + m.serviciosOperativos + m.tributos + m.amortizacion + m.gastosFinancieros, 0);
  const totalEbitda   = Object.values(pygMensual).reduce((s, m) => s + m.ebitda, 0);
  const totalResultado = Object.values(pygMensual).reduce((s, m) => s + m.resultadoNeto, 0);
  const totalCogs     = Object.values(pygMensual).reduce((s, m) => s + m.cogs, 0);

  // Caja final (último mes conocido)
  const lastMk = months[months.length - 1];
  const tesoreria = saldoCuenta(entries, CUENTAS_TESORERIA);
  // Para tesorería de activo: saldo neto = Debe - Haber
  const cajaFinal = Math.max(0, tesoreria.debe - tesoreria.haber);

  // Burn rate neto promedio mensual
  const burnRateNeto = totalIngresos < totalGastos
    ? (totalGastos - totalIngresos) / nMeses
    : 0;

  // Gastos por grupo PGC (para KPIs industriales)
  const gastosPorGrupo = {};
  for (const entry of entries) {
    if (categoryMap[entry.cuenta] === 'ignorar' || entry.cuenta.startsWith('1') || entry.cuenta.startsWith('2') || entry.cuenta.startsWith('3') || entry.cuenta.startsWith('4') || entry.cuenta.startsWith('5') || entry.cuenta.startsWith('7')) continue;
    if (entry.debe > 0) {
      gastosPorGrupo[entry.subgrupo] = (gastosPorGrupo[entry.subgrupo] || 0) + entry.debe;
    }
  }

  // Saldos de cuentas individuales
  const saldoCuentaMap = {};
  const cuentasAgrupadas = {};
  for (const entry of entries) {
    if (!cuentasAgrupadas[entry.cuenta]) cuentasAgrupadas[entry.cuenta] = { debe: 0, haber: 0 };
    cuentasAgrupadas[entry.cuenta].debe  += entry.debe;
    cuentasAgrupadas[entry.cuenta].haber += entry.haber;
  }
  for (const [cta, vals] of Object.entries(cuentasAgrupadas)) {
    saldoCuentaMap[cta] = vals.haber - vals.debe; // positivo = saldo acreedor
  }

  // Balance
  const balance = buildBalanceEstimado(entries);

  // Ingresos del último mes (para MRR)
  const lastMonthData = byMonth[lastMk] || [];

  // ---- Trust Score (calculado sobre allAnomalies, NO mutando parsedLedger) ----
  let trustScore = 100;
  allAnomalies.forEach(a => {
    if (a.severity === 'critical') trustScore -= 30;
    else if (a.severity === 'high') trustScore -= 15;
    else if (a.severity === 'medium') trustScore -= 5;
    else if (a.severity === 'low') trustScore -= 2;
  });
  // Penalización por descuadres globales (anomalías del parser o del analyzer)
  const hasDescuadreGeneral = allAnomalies.some(a => a.id === 'asiento_descuadrado' || a.id === 'descuadre_contable');
  if (hasDescuadreGeneral) trustScore -= 20;
  trustScore = Math.max(0, Math.floor(trustScore));

  // ---- Confidence Engine (bloque único, centralizado) ----
  const confidence = getConfidenceMeta(trustScore, allAnomalies, ebitdaSuspect);

  const data = {
    meta: { ...parsedLedger.meta }, // trustScore eliminado de meta (Legacy Phase 5)
    anomalies: allAnomalies,        // Fuente canónica post-análisis (parser + analyzer)
    confidence,                     // Única fuente de verdad para fiabilidad
    totales: {
      ingresos: totalIngresos,
      gastos: totalGastos,
      ebitda: totalEbitda,
      resultado: totalResultado,
      cogs: totalCogs,
      cajaFinal,
      burnRateNeto,
      gastosPorGrupo,
      saldoCuenta: saldoCuentaMap
      // ebitdaSuspect eliminado de totales (Legacy Phase 5)
    },
    balance,
    pygMensual,
    byMonth,
    lastMonth: lastMk,
    lastMonthEntries: lastMonthData,
    categoryMap // Exportamos el mapa final usado
  };

  return data;
}
