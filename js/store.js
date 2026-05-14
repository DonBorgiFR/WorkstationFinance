/**
 * store.js — Motor Reactivo de Estado Global (Vanilla JS)
 * Implementa el patrón Proxy de Estado (State Wrapping) y el patrón Pub/Sub (Observer).
 * Desacopla la lógica de datos de la capa visual de app.js.
 */

class ReactiveStore {
  constructor(initialState = {}) {
    this.events = {}; // Almacenará los suscriptores: { 'eventName': [callbacks] }
    
    // Callback interno que el Proxy llamará ante cualquier mutación del objeto
    const onMutate = (property, newValue, oldValue, targetObj) => {
      // 1. Notifica específicamente a quienes vigilan esta propiedad (ej. 'parsedLedger')
      this.publish(property, newValue, oldValue, targetObj);
      
      // 2. Notifica al wildcard '*' (útil para auditoría global o debuggers)
      this.publish('*', property, newValue, oldValue, targetObj);
    };

    // Construimos el Proxy Profundo (Deep Proxy)
    this.state = this._createDeepProxy(initialState, onMutate);
  }

  /**
   * Crea un ES6 Proxy recursivo para detectar mutaciones en objetos anidados.
   * La trampa 'set' actúa como barrera inmutable.
   */
  _createDeepProxy(target, callback) {
    const handler = {
      set: (obj, prop, value) => {
        const oldValue = obj[prop];
        
        // Si el nuevo valor inyectado es un objeto o array, lo envolvemos recursivamente
        // Esto asegura que mutaciones profundas (ej: STATE.empresa.nombre = 'X') sigan siendo reactivas
        const newValue = (value !== null && typeof value === 'object') 
          ? this._createDeepProxy(value, callback) 
          : value;

        // Solo publicamos el evento si el valor realmente ha cambiado (evita bucles)
        if (oldValue !== newValue) {
          obj[prop] = newValue;
          callback(prop, newValue, oldValue, obj);
        }
        
        return true; // Asignación exitosa
      },
      deleteProperty: (obj, prop) => {
        if (prop in obj) {
          const oldValue = obj[prop];
          delete obj[prop];
          callback(prop, undefined, oldValue, obj);
        }
        return true;
      }
    };

    // Recursividad inicial: envolvemos los objetos anidados presentes en el initialState
    for (let key in target) {
      if (target[key] !== null && typeof target[key] === 'object') {
        target[key] = this._createDeepProxy(target[key], callback);
      }
    }

    return new Proxy(target, handler);
  }

  // ==========================================
  // Patrón Pub/Sub (Observer)
  // ==========================================

  /**
   * Suscribe un callback a mutaciones de una parte específica del estado.
   * @param {string} eventName - Propiedad del estado (ej. 'parsedLedger', 'empresa', o '*' para todo).
   * @param {function} callback - Función a ejecutar cuando ocurra el cambio.
   * @returns {function} Función para desuscribirse de forma limpia.
   */
  subscribe(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);

    // Retorna la función 'unsubscribe'
    return () => {
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    };
  }

  /**
   * Dispara un evento notificando a todos sus suscriptores registrados.
   */
  publish(eventName, ...args) {
    if (this.events[eventName]) {
      this.events[eventName].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error en el suscriptor del evento "${eventName}":`, error);
        }
      });
    }
  }
}

// ==========================================
// Contrato de Datos Inicial (Data Contract)
// ==========================================
const initialDataContract = {
  parsedLedger: null,
  analysisResult: null,
  selectedProfile: null,
  customMapping: null,
  extraInputs: {},
  empresa: { nombre: '', sector: '', empleados: 0 },
  scoringInputs: {},
  scoringResult: null,
  forecastResult: null,
  forecastScenario: 'base',
  auditTrail: [],
  _pendingFile: null,
  contextChecklist: null,
  accrualsReviewed: false,
  accrualCandidates: [],
  approvedAccruals: []
};

// ==========================================
// Exportación
// ==========================================
// Instanciamos el store global. En un entorno sin módulos (script tag directos), 
// 'appStore' y su proxy 'STATE' estarán disponibles en el objeto window global.
const appStore = new ReactiveStore(initialDataContract);
const STATE = appStore.state; 
