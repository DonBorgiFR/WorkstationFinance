/**
 * profiles.js — Perfiles de Negocio y KPIs por Perfil
 * Cada perfil define: icono, nombre, descripción, KPIs específicos,
 * umbrales de semáforo y campos extra de input manual.
 */

const BUSINESS_PROFILES = [
  {
    id: 'saas',
    icon: '💻',
    name: 'SaaS / Tech',
    desc: 'Software recurrente, suscripciones',
    kpis: [
      {
        id: 'mrr',
        label: 'MRR',
        unit: '€',
        format: 'currency',
        desc: 'Monthly Recurring Revenue — suma de ingresos recurrentes del mes',
        compute: (data) => {
          // Suma cuentas 705 y 706 del último mes disponible
          const months = Object.keys(data.byMonth).sort();
          if (!months.length) return null;
          const lastEntries = data.byMonth[months[months.length - 1]] || [];
          const mrrBruto = lastEntries
            .filter(e => e.cuenta.startsWith('705') || e.cuenta.startsWith('706'))
            .reduce((sum, e) => sum + e.haber - e.debe, 0);
          return mrrBruto / 1.21; // M1: Neto de IVA
        },
        thresholds: { ok: 10000, warn: 3000 } // > ok = verde, warn-ok = amarillo, <warn = rojo
      },
      {
        id: 'arr',
        label: 'ARR',
        unit: '€',
        format: 'currency',
        desc: 'Annual Recurring Revenue — MRR × 12',
        compute: (data, kpiResults) => {
          const mrr = kpiResults?.mrr;
          return mrr != null ? mrr * 12 : null;
        },
        thresholds: { ok: 120000, warn: 36000 }
      },
      {
        id: 'burn_multiple',
        label: 'Burn Multiple',
        unit: 'x',
        format: 'decimal',
        desc: 'Net Burn / New MRR — cuánto se quema por cada € de MRR nuevo',
        compute: (data) => {
          const months = Object.keys(data.byMonth).sort();
          if (months.length < 2) return null;
          const lastMk = months[months.length - 1];
          const prevMk = months[months.length - 2];
          
          const burnNeto = Math.abs(data.pygMensual[lastMk]?.resultadoNeto || 0);
          
          const lastEntries = data.byMonth[lastMk] || [];
          const prevEntries = data.byMonth[prevMk] || [];
          
          const mrrLastBruto = lastEntries.filter(e => e.cuenta.startsWith('705') || e.cuenta.startsWith('706')).reduce((sum, e) => sum + e.haber - e.debe, 0);
          const mrrPrevBruto = prevEntries.filter(e => e.cuenta.startsWith('705') || e.cuenta.startsWith('706')).reduce((sum, e) => sum + e.haber - e.debe, 0);
          
          const mrrLast = mrrLastBruto / 1.21;
          const mrrPrev = mrrPrevBruto / 1.21;
          
          const newMrr = mrrLast - mrrPrev;
          if (!newMrr || newMrr <= 0) return null;
          return burnNeto / newMrr;
        },
        thresholds: { ok: 1.5, warn: 3, invert: true } // invertido: < ok = verde
      }
    ],
    extraInputs: [
      { id: 'saas_precio_starter', label: 'Precio Plan Starter (€/mes)', type: 'number' },
      { id: 'saas_precio_growth', label: 'Precio Plan Growth (€/mes)', type: 'number' },
      { id: 'saas_precio_enterprise', label: 'Precio Plan Enterprise (€/mes)', type: 'number' },
      { id: 'saas_clientes', label: 'Nº Clientes Totales', type: 'number' }
    ]
  },

  {
    id: 'services',
    icon: '📋',
    name: 'Servicios / Consultoría',
    desc: 'Proyectos, honorarios, consultoría',
    kpis: [
      {
        id: 'rev_per_employee',
        label: 'Facturación / Empleado',
        unit: '€',
        format: 'currency',
        desc: 'Ingresos totales divididos entre número de empleados',
        compute: (data, _kpi, extraInputs) => {
          const empleados = parseInt(extraInputs?.empleados || data.meta?.empleados || 0);
          if (!empleados) return null;
          return data.totales.ingresos / empleados;
        },
        thresholds: { ok: 5000, warn: 2000 }
      },
      {
        id: 'margen_bruto_pct',
        label: 'Margen Bruto',
        unit: '%',
        format: 'percent',
        desc: '(Ingresos - COGS) / Ingresos',
        compute: (data) => {
          if (!data.totales.ingresos) return null;
          return ((data.totales.ingresos - data.totales.cogs) / data.totales.ingresos) * 100;
        },
        thresholds: { ok: 60, warn: 35 }
      }
    ],
    extraInputs: [
      { id: 'srv_empleados_facturables', label: 'Empleados facturables', type: 'number' },
      { id: 'srv_tarifa_hora', label: 'Tarifa hora media (€)', type: 'number' }
    ]
  },

  {
    id: 'industrial',
    icon: '🏭',
    name: 'Industrial / Fabricación',
    desc: 'Manufactura, materias primas, producción',
    kpis: [
      {
        id: 'margen_bruto_mp',
        label: 'Margen Bruto s/MP',
        unit: '%',
        format: 'percent',
        desc: '(Ventas - Coste Materias Primas) / Ventas',
        compute: (data) => {
          const ventas = data.totales.ingresos;
          const mp = data.totales.gastosPorGrupo?.['600'] || 0;
          if (!ventas) return null;
          return ((ventas - mp) / ventas) * 100;
        },
        thresholds: { ok: 40, warn: 20 }
      },
      {
        id: 'dso',
        label: 'DSO (Días Cobro)',
        unit: 'días',
        format: 'integer',
        desc: 'Periodo Medio de Cobro — (Clientes / Ventas) × 365',
        compute: (data) => {
          const saldoClientes = data.totales.saldoCuenta?.['430'] || 0;
          const ventas = data.totales.ingresos;
          if (!ventas) return null;
          const meses = Object.keys(data.byMonth).length || 1;
          return (saldoClientes / (ventas / meses)) * 30;
        },
        thresholds: { ok: 60, warn: 90, invert: true }
      },
      {
        id: 'dpo',
        label: 'DPO (Días Pago)',
        unit: 'días',
        format: 'integer',
        desc: 'Periodo Medio de Pago — (Proveedores / Compras) × 365',
        compute: (data) => {
          const saldoProv = data.totales.saldoCuenta?.['400'] || 0;
          const compras = data.totales.gastosPorGrupo?.['600'] || 0;
          if (!compras) return null;
          const meses = Object.keys(data.byMonth).length || 1;
          return (saldoProv / (compras / meses)) * 30;
        },
        thresholds: { ok: 30, warn: 15 }
      }
    ],
    extraInputs: [
      { id: 'ind_inventario', label: 'Valor inventario medio (€)', type: 'number' }
    ]
  },

  {
    id: 'comercio',
    icon: '🛒',
    name: 'Comercio / Retail',
    desc: 'Ventas de productos, distribución',
    kpis: [
      {
        id: 'margen_comercial',
        label: 'Margen Comercial',
        unit: '%',
        format: 'percent',
        desc: '(Ventas - Coste mercaderías) / Ventas',
        compute: (data) => {
          const ventas = data.totales.ingresos;
          const coste = (data.totales.gastosPorGrupo?.['600'] || 0) + (data.totales.gastosPorGrupo?.['601'] || 0);
          if (!ventas) return null;
          return ((ventas - coste) / ventas) * 100;
        },
        thresholds: { ok: 35, warn: 15 }
      }
    ],
    extraInputs: [
      { id: 'com_ticket_medio', label: 'Ticket medio (€)', type: 'number' },
      { id: 'com_unidades_mes', label: 'Unidades vendidas/mes', type: 'number' }
    ]
  },

  {
    id: 'generic',
    icon: '📊',
    name: 'Genérico',
    desc: 'Solo KPIs universales APTKI',
    kpis: [],
    extraInputs: []
  }
];

// KPIs UNIVERSALES APTKI (todos los perfiles)
const UNIVERSAL_KPIS = [
  {
    id: 'runway',
    label: 'Runway',
    unit: 'meses',
    format: 'decimal',
    desc: 'Meses de caja disponibles al ritmo de gasto actual',
    compute: (data) => {
      const caja = data.totales.cajaFinal;
      const burnNeto = data.totales.burnRateNeto;
      if (!burnNeto || burnNeto <= 0) return null; // Sin burn no hay runway problema
      return caja / burnNeto;
    },
    thresholds: { ok: 12, warn: 6, invert: false }
  },
  {
    id: 'burn_rate_neto',
    label: 'Burn Rate Neto',
    unit: '€/mes',
    format: 'currency',
    desc: 'Promedio mensual de (Gastos - Ingresos)',
    compute: (data) => data.totales.burnRateNeto,
    thresholds: { ok: 0, warn: 30000, invert: true } // positivo = malo
  },
  {
    id: 'ratio_endeudamiento',
    label: 'R. Endeudamiento',
    unit: '%',
    format: 'percent',
    desc: 'Pasivo total / Patrimonio Neto. Óptimo APTKI: 40-60%',
    compute: (data) => {
      if (!data.balance) return null;
      const pn = data.balance.patrimonioNeto;
      const pasivo = data.balance.pasivoTotal;
      if (!pn) return null;
      return (pasivo / pn) * 100;
    },
    thresholds: { ok: 60, warn: 100, invert: true }
  },
  {
    id: 'ratio_liquidez',
    label: 'R. Liquidez',
    unit: 'x',
    format: 'decimal',
    desc: 'Activo Corriente / Pasivo Corriente. Óptimo > 1',
    compute: (data) => {
      if (!data.balance) return null;
      const ac = data.balance.activoCorriente;
      const pc = data.balance.pasivoCorriente;
      if (!pc) return null;
      return ac / pc;
    },
    thresholds: { ok: 1.5, warn: 1 }
  },
  {
    id: 'capital_trabajo',
    label: 'Capital de Trabajo',
    unit: '€',
    format: 'currency',
    desc: 'Activo Corriente − Pasivo Corriente (Working Capital)',
    compute: (data) => {
      if (!data.balance) return null;
      return (data.balance.activoCorriente || 0) - (data.balance.pasivoCorriente || 0);
    },
    thresholds: { ok: 0, warn: -10000, invert: false }
  },
  {
    id: 'ebitda',
    label: 'EBITDA',
    unit: '€',
    format: 'currency',
    desc: 'Resultado antes de intereses, impuestos, depreciación y amortización',
    compute: (data) => data.totales.ebitda,
    thresholds: { ok: 0, warn: -20000, invert: false }
  },
  {
    id: 'margen_bruto',
    label: 'Margen Bruto',
    unit: '%',
    format: 'percent',
    desc: '(Ingresos − COGS) / Ingresos × 100',
    compute: (data) => {
      if (!data.totales.ingresos) return null;
      return ((data.totales.ingresos - (data.totales.cogs || 0)) / data.totales.ingresos) * 100;
    },
    thresholds: { ok: 50, warn: 20 }
  },
  {
    id: 'caja_final',
    label: 'Caja Final',
    unit: '€',
    format: 'currency',
    desc: 'Saldo en cuenta bancaria/tesorería al cierre del periodo',
    compute: (data) => data.totales.cajaFinal,
    thresholds: { ok: 30000, warn: 10000 }
  }
];

// Helpers de formato
function formatKpiValue(value, format) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + ' €';
    case 'percent':
      return value.toFixed(1) + '%';
    case 'decimal':
      return value.toFixed(2);
    case 'integer':
      return Math.round(value).toString();
    default:
      return value.toString();
  }
}

function getKpiStatus(kpi, value) {
  if (value === null || value === undefined || isNaN(value)) return 'neutral';
  const { ok, warn, invert } = kpi.thresholds || {};
  if (ok === undefined) return 'neutral';
  if (!invert) {
    if (value >= ok) return 'ok';
    if (warn !== undefined && value >= warn) return 'warn';
    return 'danger';
  } else {
    if (value <= ok) return 'ok';
    if (warn !== undefined && value <= warn) return 'warn';
    return 'danger';
  }
}

function getStatusIcon(status) {
  return { ok: '🟢', warn: '🟡', danger: '🔴', neutral: '⚪' }[status] || '⚪';
}
