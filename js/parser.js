/**
 * parser.js — Motor Universal de Parseo de Libros Diarios PGC
 *
 * Soporta:
 *   - Pestañas mensuales (Enero, Febrero... / Ene, Feb... / 01, 02...)
 *   - Una sola pestaña con columna Fecha (agrupa por mes automáticamente)
 *   - Columnas: Fecha | Asiento/Nº | Cuenta | Concepto/Descripción | Debe | Haber
 *
 * Output (objeto `ParsedLedger`):
 *   meta       → nombre fichero, meses, nº asientos, cuentas únicas
 *   entries    → array plano de todos los asientos normalizados
 *   byMonth    → asientos agrupados por mes (clave YYYY-MM)
 *   anomalies  → array de { severity, message, detail }
 */

const MONTH_NAMES = {
  enero:1, january:1, jan:1, ene:1, '01':1,
  febrero:2, february:2, feb:2, '02':2,
  marzo:3, march:3, mar:3, '03':3,
  abril:4, april:4, abr:4, apr:4, '04':4,
  mayo:5, may:5, '05':5,
  junio:6, june:6, jun:6, '06':6,
  julio:7, july:7, jul:7, '07':7,
  agosto:8, august:8, ago:8, aug:8, '08':8,
  septiembre:9, september:9, sep:9, sept:9, '09':9,
  octubre:10, october:10, oct:10, '10':10,
  noviembre:11, november:11, nov:11, '11':11,
  diciembre:12, december:12, dic:12, dec:12, '12':12
};

// Columnas que esperamos encontrar (variantes de nombre)
const COL_CANDIDATES = {
  fecha:       ['fecha','date','f','dia','día'],
  asiento:     ['asiento','nº','n°','num','número','numero','seq','id'],
  cuenta:      ['cuenta','account','cod','código','codigo','cta'],
  descripcion: ['descripcion','descripción','concepto','concept','detalle','detail','texto','glosa'],
  debe:        ['importedebe','importe debe','debe','debit','debito','débito','cargo'],
  haber:       ['importehaber','importe haber','haber','credit','credito','crédito','abono']
};

// ---- Utilidades ----
function normalizeHeader(h) {
  return String(h || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9]/g, '');
}

function detectColumn(headers, candidates) {
  const normalized = headers.map(normalizeHeader);
  for (const rawCand of candidates) {
    const cand = normalizeHeader(rawCand);
    const idx = normalized.findIndex(h => h === cand || (cand.length >= 3 && h.includes(cand)));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDate(val) {
  if (!val) return null;
  // Excel serial date
  if (typeof val === 'number' && val > 1000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d;
  }
  // String
  const s = String(val).trim();
  const d = new Date(s);
  if (!isNaN(d)) return d;
  // dd/mm/yyyy
  const m = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    return new Date(year, parseInt(m[2]) - 1, parseInt(m[1]));
  }
  return null;
}

function toMonthKey(date, fallbackMonth) {
  if (date && !isNaN(date)) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  if (fallbackMonth) {
    return `2025-${String(fallbackMonth).padStart(2, '0')}`;
  }
  return 'desconocido';
}

function detectMonthFromSheetName(name) {
  const norm = normalizeHeader(name);
  // Check direct match
  for (const [key, val] of Object.entries(MONTH_NAMES)) {
    if (norm === key || norm.startsWith(key)) return val;
  }
  // Extract number from name like "Mes1", "M01", "Hoja1"
  const numMatch = norm.match(/(\d{1,2})$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}

// ---- Parser principal ----
function parseSheetRows(rows, sheetName, fallbackMonth, logFn) {
  if (!rows || rows.length === 0) return [];

  // Buscar fila de cabecera: la que más celdas no vacías tenga en las primeras 15 filas
  // Esto maneja libros con filas de metadatos antes de la cabecera real
  let headerRowIdx = 0;
  let bestCount = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!row) continue;
    const nonEmpty = row.filter(c => c !== null && c !== undefined && c !== '').length;
    if (nonEmpty > bestCount) {
      bestCount = nonEmpty;
      headerRowIdx = i;
    }
  }

  const headers = (rows[headerRowIdx] || []).map(h => String(h || ''));
  const colFecha  = detectColumn(headers, COL_CANDIDATES.fecha);
  const colAsiento = detectColumn(headers, COL_CANDIDATES.asiento);
  const colCuenta = detectColumn(headers, COL_CANDIDATES.cuenta);
  const colDesc   = detectColumn(headers, COL_CANDIDATES.descripcion);
  const colDebe   = detectColumn(headers, COL_CANDIDATES.debe);
  const colHaber  = detectColumn(headers, COL_CANDIDATES.haber);

  if (colDebe === -1 || colHaber === -1) {
    logFn(`warn|Hoja "${sheetName}": no se encontraron columnas Debe/Haber — omitida`);
    return [];
  }
  if (colCuenta === -1) {
    logFn(`warn|Hoja "${sheetName}": no se encontró columna Cuenta — intentando continuar`);
  }

  const entries = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const debe  = parseNumber(row[colDebe]);
    const haber = parseNumber(row[colHaber]);
    if (debe === 0 && haber === 0) continue; // fila vacía

    const rawCuenta = colCuenta >= 0 ? String(row[colCuenta] || '').trim() : '';
    const cuenta = rawCuenta.replace(/[^0-9a-zA-Z]/g, '');
    if (!cuenta) continue;

    const rawFecha = colFecha >= 0 ? row[colFecha] : null;
    const fecha = parseDate(rawFecha);
    const monthKey = toMonthKey(fecha, fallbackMonth);

    const desc = colDesc >= 0 ? String(row[colDesc] || '').trim() : '';
    const asiento = colAsiento >= 0 ? String(row[colAsiento] || '').trim() : '';

    entries.push({
      sheet: sheetName,
      monthKey,
      fecha: fecha ? fecha.toISOString().split('T')[0] : null,
      asiento,
      cuenta,
      grupo: cuenta.charAt(0),      // primer dígito = grupo PGC
      subgrupo: cuenta.substring(0, 2),
      descripcion: desc,
      debe,
      haber
    });
  }

  return entries;
}

// ---- Detección de anomalías ----
function detectAnomalies(entries, byMonth) {
  const anomalies = [];
  const months = Object.keys(byMonth).sort();

  // 1. Descuadre Debe ≠ Haber por mes
  for (const mk of months) {
    const grp = byMonth[mk];
    const totalDebe  = grp.reduce((s, e) => s + e.debe, 0);
    const totalHaber = grp.reduce((s, e) => s + e.haber, 0);
    const diff = Math.abs(totalDebe - totalHaber);
    if (diff > 1) { // tolerancia 1€ por redondeos
      anomalies.push({
        id: 'descuadre_contable',
        severity: 'high',
        month: mk,
        message: `Descuadre contable en ${mk}`,
        detail: `Debe=${totalDebe.toFixed(2)}€, Haber=${totalHaber.toFixed(2)}€, Diferencia=${diff.toFixed(2)}€`
      });
    }
  }

  // 2. Meses sin amortizaciones (cuentas 680/681/682) cuando otros sí las tienen
  const monthsWithAmort = months.filter(mk =>
    byMonth[mk].some(e => e.cuenta.startsWith('68'))
  );
  const monthsWithoutAmort = months.filter(mk =>
    !byMonth[mk].some(e => e.cuenta.startsWith('68'))
  );
  if (monthsWithAmort.length > 0 && monthsWithoutAmort.length > 0) {
    anomalies.push({
      id: 'meses_sin_amortizacion',
      severity: 'medium',
      month: monthsWithoutAmort.join(', '),
      message: 'Meses sin amortización cuando otros sí la registran',
      detail: `Sin amort: ${monthsWithoutAmort.join(', ')} | Con amort: ${monthsWithAmort.join(', ')}`
    });
  }

  // 3. Saltos bruscos en ingresos totales (> 40% mes a mes)
  for (let i = 1; i < months.length; i++) {
    const mk = months[i];
    const prev = months[i - 1];
    const ingActual = byMonth[mk].filter(e => e.grupo === '7').reduce((s, e) => s + e.haber, 0);
    const ingPrev   = byMonth[prev].filter(e => e.grupo === '7').reduce((s, e) => s + e.haber, 0);
    if (ingPrev > 0) {
      const pct = Math.abs((ingActual - ingPrev) / ingPrev) * 100;
      if (pct > 40) {
        anomalies.push({
          id: 'variacion_brusca_ingresos',
          severity: 'medium',
          month: mk,
          message: `Variación brusca en ingresos (${pct.toFixed(0)}%)`,
          detail: `${prev}: ${ingPrev.toFixed(0)}€ → ${mk}: ${ingActual.toFixed(0)}€`
        });
      }
    }
  }

  // 4. Movimientos en cuenta de resultados (129) mezclados en periodos
  const hasResultados = entries.some(e => e.cuenta.startsWith('129'));
  if (hasResultados) {
    anomalies.push({
      id: 'cuenta_129_detectada',
      severity: 'low',
      month: 'General',
      message: 'Se detectaron apuntes en cuenta 129 (Resultado del ejercicio)',
      detail: 'Verificar que el cierre contable se realizó correctamente'
    });
  }

  return anomalies;
}

// ---- API PÚBLICA ----
/**
 * parseLedgerFile(file, onProgress) → Promise<ParsedLedger>
 * @param {File} file — Archivo .xlsx
 * @param {Function} onProgress — callback({ pct, text, log })
 */
async function parseLedgerFile(file, onProgress) {
  const log = (msg) => onProgress && onProgress({ log: msg });
  const progress = (pct, text) => onProgress && onProgress({ pct, text });

  progress(5, 'Leyendo archivo...');
  log('ok|Archivo recibido: ' + file.name);

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  progress(15, 'Detectando estructura...');
  const sheetNames = workbook.SheetNames;
  log('ok|Hojas encontradas: ' + sheetNames.join(', '));

  const entries = [];
  const step = 60 / Math.max(sheetNames.length, 1);

  for (let si = 0; si < sheetNames.length; si++) {
    const sheetName = sheetNames[si];
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    progress(15 + step * si, `Procesando hoja "${sheetName}"...`);

    // ¿Es una hoja mensual?
    const monthNum = detectMonthFromSheetName(sheetName);
    if (monthNum) {
      log(`ok|Hoja mensual detectada: "${sheetName}" → mes ${monthNum}`);
    } else {
      log(`ok|Hoja detectada: "${sheetName}" (sin mes explícito)`);
    }

    const sheetEntries = parseSheetRows(rows, sheetName, monthNum, log);
    entries.push(...sheetEntries);
    log(`ok|${sheetEntries.length} asientos leídos en "${sheetName}"`);
  }

  progress(80, 'Agrupando por mes...');

  // Agrupar por monthKey
  const byMonth = {};
  for (const entry of entries) {
    if (!byMonth[entry.monthKey]) byMonth[entry.monthKey] = [];
    byMonth[entry.monthKey].push(entry);
  }

  progress(88, 'Detectando anomalías...');
  const anomalies = detectAnomalies(entries, byMonth);
  log(`${anomalies.length > 0 ? 'warn' : 'ok'}|${anomalies.length} anomalías detectadas`);

  // Cuentas únicas
  const cuentasUnicas = new Set(entries.map(e => e.cuenta));

  progress(95, 'Finalizando...');
  log('ok|Parseo completado');
  progress(100, 'Listo');

  return {
    meta: {
      fileName: file.name,
      sheets: sheetNames,
      months: Object.keys(byMonth).sort(),
      totalEntries: entries.length,
      totalCuentas: cuentasUnicas.size
    },
    entries,
    byMonth,
    anomalies
  };
}
