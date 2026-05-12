/**
 * exporter.js — Motor de exportación a Excel y PDF
 * Genera reportes profesionales para el cliente o consejo.
 */

// ---- Exportar a PDF (html2pdf) ----
document.addEventListener('DOMContentLoaded', () => {
  const btnPdf = document.getElementById('btn-export-pdf');
  const btnExcel = document.getElementById('btn-export-excel');

  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      if (!STATE.analysisResult) return;
      const element = document.getElementById('dashboard-content');
      const opt = {
        margin:       10,
        filename:     `${STATE.empresa.nombre || 'dashboard'}_aptki.pdf`.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f1115' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Ocultar elementos que no queremos en el PDF momentáneamente
      const btnGroup = document.querySelector('#kpi-perfil-title');
      const prevColor = element.style.color;
      
      // Aplicar un estilo de impresión básico (evitar que el scrollbars y dark mode se vean mal)
      element.style.background = '#0f1115';
      
      showToast('Generando PDF...', 'info', 2000);
      html2pdf().set(opt).from(element).save().then(() => {
        showToast('PDF Exportado ✓', 'success');
      });
    });
  }

  if (btnExcel) {
    btnExcel.addEventListener('click', () => {
      if (!STATE.analysisResult) return;
      exportToExcel(STATE.analysisResult, STATE.forecastResult, STATE.scoringResult);
    });
  }
});


// ---- Exportar a Excel Vivo (SheetJS) ----
/**
 * exportToExcel(data, forecast, scoring)
 * @description Genera un archivo Excel multioja (.xlsx) usando SheetJS. A diferencia de un CSV plano, 
 * este exportador inyecta fórmulas vivas de Excel (SUM, restas) en la PyG para que el modelo financiero 
 * siga siendo interactivo para el cliente final.
 * @param {Object} data - AnalysisResult de analyzer.js.
 * @param {Object} forecast - ForecastResult de forecaster.js.
 * @param {Object} scoring - ScoringResult de scorer.js.
 * @returns {void} Inicia la descarga del Excel en el navegador.
 */
function exportToExcel(data, forecast, scoring) {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Pestaña: PyG Analítica (Con fórmulas vivas)
    const wsPyG = buildPyGSheet(data.pygMensual);
    XLSX.utils.book_append_sheet(wb, wsPyG, "PyG Analítica");

    // 2. Pestaña: Balance y KPIs
    const wsKPIs = buildKPISheet(data);
    XLSX.utils.book_append_sheet(wb, wsKPIs, "KPIs y Balance");

    // 3. Pestaña: Forecast 12M
    if (forecast && forecast.scenarios && forecast.scenarios.base) {
      const wsForecast = buildForecastSheet(forecast);
      XLSX.utils.book_append_sheet(wb, wsForecast, "Forecast 12M");
    }

    // Exportar
    const fileName = `${STATE.empresa.nombre || 'modelo'}_financiero_aptki.xlsx`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(wb, fileName);
    showToast('Excel Exportado ✓', 'success');

  } catch (err) {
    console.error("Error al exportar Excel:", err);
    showToast('Error al generar Excel', 'error');
  }
}

/**
 * buildPyGSheet(pygMensual)
 * @description Construye la hoja de cálculo "PyG Analítica". Inyecta fórmulas nativas (ej: `SUM(B2:B3)`) 
 * en lugar de valores estáticos para los cálculos de subtotales (EBITDA, Margen Bruto, etc.).
 * @param {Object} pygMensual - Mapa de meses a resultados de PyG.
 * @returns {Object} Un worksheet de SheetJS listo para ser añadido a un workbook.
 */
function buildPyGSheet(pygMensual) {
  const months = Object.keys(pygMensual).sort();
  const numMonths = months.length;
  
  // AOA (Array of Arrays) para SheetJS
  const aoa = [];
  
  // Fila 1: Cabeceras
  const headers = ["Partida", ...months, "TOTAL"];
  aoa.push(headers);

  // Mapeo de filas lógicas a su índice en Excel (0-indexed array = fila Excel 1)
  // Partidas (los valores los pondremos en positivo, restaremos con fórmula)
  const rowsConfig = [
    { key: 'ventas', label: 'Ventas / Servicios', type: 'val' },             // Row 2
    { key: 'otrosIngresos', label: 'Otros Ingresos', type: 'val' },          // Row 3
    { label: 'TOTAL INGRESOS', type: 'form', f: (col) => `SUM(${col}2:${col}3)` }, // Row 4
    { key: 'cogs', label: 'Coste de Ventas (COGS)', type: 'val' },           // Row 5
    { label: 'MARGEN BRUTO', type: 'form', f: (col) => `${col}4-${col}5` },  // Row 6
    { key: 'personal', label: 'Personal', type: 'val' },                     // Row 7
    { key: 'marketing', label: 'Marketing', type: 'val' },                   // Row 8
    { key: 'serviciosOperativos', label: 'Servicios Operativos', type: 'val' }, // Row 9
    { key: 'tributos', label: 'Tributos', type: 'val' },                     // Row 10
    { label: 'EBITDA', type: 'form', f: (col) => `${col}6-SUM(${col}7:${col}10)` }, // Row 11
    { key: 'amortizacion', label: 'Amortización', type: 'val' },             // Row 12
    { label: 'EBIT', type: 'form', f: (col) => `${col}11-${col}12` },        // Row 13
    { key: 'gastosFinancieros', label: 'Gastos Financieros', type: 'val' },  // Row 14
    { label: 'RESULTADO NETO', type: 'form', f: (col) => `${col}13-${col}14` } // Row 15
  ];

  // Helper para obtener letra de columna Excel (A, B, C...)
  function getColLetter(colIndex) {
    let letter = '';
    while (colIndex >= 0) {
      letter = String.fromCharCode((colIndex % 26) + 65) + letter;
      colIndex = Math.floor(colIndex / 26) - 1;
    }
    return letter;
  }

  // Rellenar datos y fórmulas
  rowsConfig.forEach((cfg, rIdx) => {
    const rowData = [cfg.label];
    
    // Columnas de meses
    for (let cIdx = 0; cIdx < numMonths; cIdx++) {
      const colLetter = getColLetter(cIdx + 1); // +1 porque col 0 es "Partida"
      
      if (cfg.type === 'val') {
        const val = pygMensual[months[cIdx]][cfg.key] || 0;
        rowData.push({ t: 'n', v: val });
      } else if (cfg.type === 'form') {
        const formula = cfg.f(colLetter);
        rowData.push({ t: 'n', f: formula });
      }
    }

    // Columna TOTAL
    const totalColLetter = getColLetter(numMonths + 1);
    const startCol = getColLetter(1);
    const endCol = getColLetter(numMonths);
    const rowExcel = rIdx + 2; // +2 por la cabecera y porque excel es 1-indexed
    
    if (cfg.type === 'val') {
      rowData.push({ t: 'n', f: `SUM(${startCol}${rowExcel}:${endCol}${rowExcel})` });
    } else if (cfg.type === 'form') {
      rowData.push({ t: 'n', f: cfg.f(totalColLetter) }); // Total column applies the same vertical logic
    }

    aoa.push(rowData);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  
  // Anchura de columnas
  const wscols = [{ wch: 25 }];
  for(let i=0; i<=numMonths; i++) wscols.push({ wch: 12 });
  ws['!cols'] = wscols;

  return ws;
}

/**
 * buildKPISheet(data)
 * @description Construye la hoja de cálculo estática con los KPIs agregados y el balance estimado.
 * @param {Object} data - AnalysisResult de analyzer.js.
 * @returns {Object} Un worksheet de SheetJS.
 */
function buildKPISheet(data) {
  const aoa = [
    ["KPIs y Resumen de Balance"],
    [],
    ["Métrica", "Valor"],
    ["Caja Final", { t: 'n', v: data.totales.cajaFinal }],
    ["Burn Rate Neto Promedio", { t: 'n', v: data.totales.burnRateNeto }],
    ["Ingresos Totales", { t: 'n', v: data.totales.ingresos }],
    ["EBITDA Total", { t: 'n', v: data.totales.ebitda }],
    [],
    ["Balance Estimado", ""],
    ["Activo Corriente", { t: 'n', v: data.balance.activoCorriente }],
    ["Activo No Corriente", { t: 'n', v: data.balance.activoNoCorriente }],
    ["Pasivo Corriente", { t: 'n', v: data.balance.pasivoCorriente }],
    ["Pasivo No Corriente (Deuda LP)", { t: 'n', v: data.balance.pasivoNoCorriente }],
    ["Patrimonio Neto", { t: 'n', v: data.balance.patrimonioNeto }]
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 30 }, { wch: 15 }];
  return ws;
}

/**
 * buildForecastSheet(forecast)
 * @description Construye la hoja de cálculo con la proyección a 12 meses (Escenario Base). 
 * Inyecta fórmulas básicas para el cálculo del EBITDA futuro.
 * @param {Object} forecast - ForecastResult con escenarios precalculados.
 * @returns {Object} Un worksheet de SheetJS.
 */
function buildForecastSheet(forecast) {
  const aoa = [];
  const base = forecast.scenarios.base;
  
  // Headers
  const headers = ["Mes", "Ingresos", "OPEX", "EBITDA", "Caja Acumulada"];
  aoa.push(["Forecast 12 Meses - Escenario Base"]);
  aoa.push([]);
  aoa.push(headers);

  // Data
  base.forEach(r => {
    aoa.push([
      r.mes,
      { t: 'n', v: r.ingresos },
      { t: 'n', v: r.opex },
      { t: 'n', f: `B${aoa.length+1}-C${aoa.length+1}` }, // Formula EBITDA = Ingresos - Opex
      { t: 'n', v: r.caja } // Caja es acumulativa, podríamos hacer formula pero es más complejo si hay eventos extra. Lo dejamos estático.
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  return ws;
}
