// voz_carrito.js (versión integrada con guardado en la misma API y sincronización)
// voz_carrito.js (final) - historial con fecha/hora, barra de progreso y sincronización
// --------------------------------------------------
// Usa la misma API base que control_carrito
const API_BASE = "http://52.72.153.166:5500/api"; // ajusta si usas otra IP o puerto

// --------------------------------------------------
// DOM (si el script se carga en head, protegemos con DOMContentLoaded)
let btn, statusDiv, actionDiv, historyList, clearBtn, toggleModeBtn;
document.addEventListener("DOMContentLoaded", () => {
  btn = document.getElementById("btn");
  statusDiv = document.getElementById("status");
  actionDiv = document.getElementById("action");
  historyList = document.getElementById("history");
  clearBtn = document.getElementById("clearHistory");
  toggleModeBtn = document.getElementById("toggleMode");

  // seguridad: si no existen elementos, no romper (creamos placeholders)
  if (!btn) console.warn("No se encontró #btn en DOM (voz_carrito).");
  if (!statusDiv) statusDiv = document.createElement("div");
  if (!actionDiv) actionDiv = document.createElement("div");
  if (!historyList) {
    historyList = document.createElement("ul");
    historyList.id = "history";
  }

  // ligar eventos UI
  if (btn) btn.addEventListener("click", () => recognition.start());

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      // limpia historial visual
      historyList.innerHTML = "";
      // limpia conteo de sesión y sincroniza (igual que control_carrito)
      clearSessionMovs();
      // limpiar key de sync para evitar re-disparo en otras pestañas
      try { localStorage.removeItem("ultimoMovimientoSync"); } catch(e) {}
      // actualizar barra superior / contador
      updateSessionProgress();
      // feedback UI pequeño
      if (actionDiv) actionDiv.textContent = "🗑️ Historial (sesión) limpiado";
    });
  }

  if (toggleModeBtn) toggleModeBtn.addEventListener("click", () => document.body.classList.toggle("dark-mode"));

  // restaurar historial desde sessionStorage (si hay)
  restoreHistoryFromSession();

  // actualizar progreso inicial
  updateSessionProgress();
});

// --------------------------------------------------
// Session / local helpers (compatibles con control_carrito)
function getSessionMovs() {
  const s = sessionStorage.getItem("sessionMovs");
  return s ? JSON.parse(s) : [];
}
function pushSessionMov(id) {
  const arr = getSessionMovs();
  arr.push({ id: Number(id), ts: new Date().toISOString() });
  sessionStorage.setItem("sessionMovs", JSON.stringify(arr));
}
function clearSessionMovs() {
  sessionStorage.removeItem("sessionMovs");
}
// push solo si no igual al último (evita duplicados consecutivos)
function pushSessionIfNotLast(id) {
  if (!id) return;
  const arr = getSessionMovs();
  const last = arr.length ? arr[arr.length - 1] : null;
  if (!last || Number(last.id) !== Number(id)) {
    pushSessionMov(id);
  }
}
function sessionCount() {
  return getSessionMovs().length;
}

// --------------------------------------------------
// Restaurar historial de sessionStorage en el UL al iniciar
function restoreHistoryFromSession() {
  const arr = getSessionMovs();
  if (!arr || !arr.length) return;

  // mostramos los últimos N (por ejemplo 8)
  const maxShow = 8;
  const show = arr.slice(Math.max(0, arr.length - maxShow));
  // limpiar visual antes
  if (historyList) historyList.innerHTML = "";

  // crear elementos desde los más recientes a los más antiguos (prepend)
  for (let i = show.length - 1; i >= 0; i--) {
    const e = show[i];
    const id = e.id;
    const ts = e.ts;
    const fecha = new Date(ts);
    const fechaStr = fecha.toLocaleDateString();
    const horaStr = fecha.toLocaleTimeString();
    const movimiento = CATALOGO[id] || `Movimiento ${id}`;
    const icono = iconos[movimiento.toLowerCase()] || "👉";

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="history-entry">
        <div class="history-left">
          <div class="history-icon">${icono}</div>
          <div>
            <div class="history-mov">${movimiento}</div>
          </div>
        </div>
        <div class="history-time">${fechaStr} ${horaStr}</div>
      </div>
      <div class="entry-bar"><div class="entry-bar-fill" style="width:0%"></div></div>
    `;
    historyList.prepend(li);

    // animar barra proporcional al índice de la sesión actual
    const fillEl = li.querySelector(".entry-bar-fill");
    const cnt = sessionCount();
    const pct = Math.min(100, Math.round((cnt / 5) * 100));
    if (fillEl) setTimeout(() => { fillEl.style.width = pct + "%"; }, 40);
  }
}

// --------------------------------------------------
// Obtención de API Key (MockAPI)
let cachedApiKey = null;
async function obtenerApiKey() {
  if (cachedApiKey) return cachedApiKey;
  try {
    if (actionDiv) actionDiv.textContent = "🔐 Obteniendo clave de seguridad...";
    const response = await fetch("https://68e538928e116898997ee64c.mockapi.io/apikey");
    const data = await response.json();
    cachedApiKey = data[0].Api_Key;
    if (actionDiv) actionDiv.textContent = "✅ Clave cargada correctamente";
    return cachedApiKey;
  } catch (error) {
    console.error("❌ Error al obtener la API Key:", error);
    if (actionDiv) actionDiv.textContent = "⚠️ Error al obtener la clave de seguridad";
    return null;
  }
}

// --------------------------------------------------
// Iconos y catálogo local (mantener consistencia con control_carrito)
const iconos = {
  "adelante": "🚗",
  "atrás": "↩️",
  "detener": "⏹️",
  "vuelta adelante derecha": "↘️",
  "vuelta adelante izquierda": "↙️",
  "vuelta atrás derecha": "↩️➡️",
  "vuelta atrás izquierda": "↩️⬅️",
  "giro 90 derecha": "↪️",
  "giro 90 izquierda": "↩️",
  "giro 360 derecha": "🔄",
  "giro 360 izquierda": "🔄"
};

const CATALOGO = {
  1: "Adelante",
  2: "Atrás",
  3: "Detener",
  4: "Vuelta adelante derecha",
  5: "Vuelta adelante izquierda",
  6: "Vuelta atrás derecha",
  7: "Vuelta atrás izquierda",
  8: "Giro 90° derecha",
  9: "Giro 90° izquierda",
  10: "Giro 360° derecha",
  11: "Giro 360° izquierda",
};

// --------------------------------------------------
// Reconocimiento de voz
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = "es-ES";
recognition.continuous = false;
recognition.interimResults = false;

const palabraClave = "mike"; // palabra clave de activación

recognition.onstart = () => {
  if (statusDiv) statusDiv.textContent = "🟢 Escuchando...";
  if (btn) { btn.classList.add("listening"); btn.disabled = true; }
};

recognition.onend = () => {
  if (statusDiv) statusDiv.textContent = "🔴 Inactivo";
  if (btn) { btn.classList.remove("listening"); btn.disabled = false; }
};

recognition.onerror = (e) => {
  console.error("SpeechRecognition error:", e);
  if (actionDiv) actionDiv.textContent = "⚠️ Error de reconocimiento";
};

// --------------------------------------------------
// Interpretación del texto con OpenAI
async function interpretarComando(texto) {
  const prompt = `
Eres un sistema que controla un carrito. 
El usuario ya dijo la palabra clave "${palabraClave}", ahora identifica el movimiento exacto.
Los movimientos válidos son:

1. Adelante
2. Atrás
3. Detener
4. Vuelta adelante derecha
5. Vuelta adelante izquierda
6. Vuelta atrás derecha
7. Vuelta atrás izquierda
8. Giro 90 derecha
9. Giro 90 izquierda
10. Giro 360 derecha
11. Giro 360 izquierda

Texto reconocido: "${texto}"
Responde SOLO con el nombre exacto del movimiento de la lista. 
Si no encuentras coincidencia, responde "ninguno".
`;

  try {
    const OPENAI_API_KEY = await obtenerApiKey();
    if (!OPENAI_API_KEY) return null;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 20
      }),
    });

    const data = await response.json();
    const respuesta = (data?.choices?.[0]?.message?.content || "").trim();
    console.log("Respuesta OpenAI:", respuesta);

    if (respuesta.toLowerCase() === "ninguno") return null;
    return respuesta;
  } catch (error) {
    console.error("Error con OpenAI:", error);
    return null;
  }
}

// --------------------------------------------------
// Síntesis de voz (feedback)
function hablar(texto) {
  const speech = new SpeechSynthesisUtterance(texto);
  speech.lang = "es-ES";
  window.speechSynthesis.speak(speech);
}

// --------------------------------------------------
// --- actualizar la barra de progreso superior (0..5)
function updateSessionProgress() {
  const cnt = sessionCount();
  const max = 5;
  const pct = Math.min(100, Math.round((cnt / max) * 100));
  const fill = document.getElementById("progressFill");
  const counter = document.getElementById("sessionCounter");
  if (fill) fill.style.width = pct + "%";
  if (counter) counter.textContent = `${cnt}/${max}`;
}

// --------------------------------------------------
// Historial visual (UI) - agrega fecha/hora y barra por entrada
function agregarHistorial(comando, opcionalTs = null) {
  const historyEl = document.getElementById("history");
  if (!historyEl) return;

  const ahora = opcionalTs ? new Date(opcionalTs) : new Date();
  const fechaStr = ahora.toLocaleDateString(); // e.g. 5/11/2025
  const horaStr = ahora.toLocaleTimeString(); // e.g. 10:34:12
  const tiempo = `${fechaStr} ${horaStr}`;

  // icono por comando (usa tu mapa 'iconos' definido antes)
  const clave = (comando || "").toLowerCase();
  const icono = (typeof iconos !== "undefined" && iconos[clave]) ? iconos[clave] : "👉";

  // Determinar idMovimiento a partir del comando (para sessionStorage)
  const posibleId = obtenerIdMovimiento(comando);

  // Añadir a session si no es duplicado consecutivo
  if (posibleId) pushSessionIfNotLast(posibleId);

  // construir el LI con estructura y barra interior
  const li = document.createElement("li");
  li.classList.add("history-item");

  li.innerHTML = `
    <div class="history-entry">
      <div class="history-left">
        <div class="history-icon">${icono}</div>
        <div>
          <div class="history-mov">${comando}</div>
        </div>
      </div>
      <div class="history-time">${tiempo}</div>
    </div>
    <div class="entry-bar"><div class="entry-bar-fill" style="width:0%"></div></div>
  `;

  // Prepend: último arriba
  historyEl.prepend(li);

  // animar la barra interna: ancho proporcional al número de movimientos en sesión
  const fillEl = li.querySelector(".entry-bar-fill");
  const cnt = sessionCount();
  const pct = Math.min(100, Math.round((cnt / 5) * 100));
  if (fillEl) {
    // dar pequeño retraso para que la transición CSS ocurra
    setTimeout(() => { fillEl.style.width = pct + "%"; }, 60);
  }

  // Limitar número de elementos en DOM para que no crezca indefinidamente (ej. máximo 50)
  const maxItems = 50;
  while (historyEl.children.length > maxItems) {
    historyEl.removeChild(historyEl.lastChild);
  }

  // actualizar la barra superior / contador
  updateSessionProgress();
}

// --------------------------------------------------
// Convertir nombre a id_movimiento
function obtenerIdMovimiento(nombre) {
  const mapa = {
    "adelante": 1,
    "atrás": 2,
    "detener": 3,
    "vuelta adelante derecha": 4,
    "vuelta adelante izquierda": 5,
    "vuelta atrás derecha": 6,
    "vuelta atrás izquierda": 7,
    "giro 90 derecha": 8,
    "giro 90 izquierda": 9,
    "giro 360 derecha": 10,
    "giro 360 izquierda": 11
  };
  let key = (nombre || "").toLowerCase().trim();
  if (key.includes("atras")) key = key.replace("atras", "atrás");
  return mapa[key] || null;
}

// --------------------------------------------------
// Enviar movimiento a la base (robusta y compatible)
// - guarda en localStorage (ultimoMovimiento, ultimaFecha)
// - emite CustomEvent "movimientoGuardado"
// - sincroniza con otras pestañas mediante localStorage
// NOTA: usamos pushSessionIfNotLast en vez de push sin checks para evitar duplicados
async function enviarMovimientoABase(id_movimiento) {
  try {
    if (actionDiv) actionDiv.textContent = `Guardando movimiento ${id_movimiento}...`;

    const res = await fetch(`${API_BASE}/movimientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_movimiento }),
    });

    if (!res.ok) {
      let errText = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.message) errText += ` - ${j.message}`; } catch(e){ }
      throw new Error(errText);
    }

    const data = await res.json();
    console.log("✅ Movimiento guardado en base:", id_movimiento, data);

    // intentar extraer fecha desde la respuesta en varios formatos
    const fechaApi = data?.data?.fecha_hora || data?.fecha_hora || data?.created_at || new Date().toISOString();

    // nombre legible del movimiento (si existe en catálogo)
    const movNombre = CATALOGO[id_movimiento] || "";

    // guarda último mov y fecha en localStorage (igual que control_carrito)
    localStorage.setItem("ultimoMovimiento", String(id_movimiento));
    if (fechaApi) localStorage.setItem("ultimaFecha", fechaApi);

    // push a session si no duplicado
    pushSessionIfNotLast(id_movimiento);

    // feedback UI
    if (actionDiv) actionDiv.textContent = `✅ Movimiento guardado: ${movNombre || id_movimiento}`;

    // emitir evento para listeners en la misma pestaña
    const detalle = { id_movimiento, fecha: fechaApi, movimiento: movNombre };
    window.dispatchEvent(new CustomEvent("movimientoGuardado", { detail: detalle }));

    // sincronizar con otras pestañas mediante localStorage
    try {
      const payload = JSON.stringify({ id_movimiento, fecha: fechaApi, movimiento: movNombre, ts: new Date().toISOString() });
      localStorage.setItem("ultimoMovimientoSync", payload);
      // opcional: eliminar después si no quieres que quede
      // setTimeout(() => localStorage.removeItem("ultimoMovimientoSync"), 500);
    } catch (e) {
      console.warn("No se pudo escribir ultimoMovimientoSync:", e);
    }

    return data;
  } catch (error) {
    console.error("❌ Error al guardar el movimiento:", error);
    if (actionDiv) actionDiv.textContent = `⚠️ Error guardando movimiento: ${error.message || error}`;
    return null;
  }
}

// --------------------------------------------------
// Manejo del resultado de reconocimiento
recognition.onresult = async (event) => {
  let texto = event.results[0][0].transcript.toLowerCase().trim();
  console.log("Reconocido:", texto);

  if (!texto.includes(palabraClave.toLowerCase())) {
    if (actionDiv) actionDiv.textContent = "⚠️ Debes decir la palabra clave primero";
    hablar("Debes decir la palabra clave primero");
    return;
  }

  const comando = await interpretarComando(texto);
  if (comando) {
    const icono = iconos[comando.toLowerCase()] || "👉";
    if (actionDiv) actionDiv.textContent = icono + " " + comando;
    hablar("Ejecutando: " + comando);

    // Agregar al historial visual (esto también hace pushSessionIfNotLast)
    agregarHistorial(comando);

    // Obtener ID y enviar a la base
    const idMovimiento = obtenerIdMovimiento(comando);
    if (idMovimiento) {
      await enviarMovimientoABase(idMovimiento);
    } else {
      console.warn("Movimiento no reconocido para guardar:", comando);
      if (actionDiv) actionDiv.textContent = "⚠️ Movimiento no reconocido para guardar";
    }

  } else {
    if (actionDiv) actionDiv.textContent = "❌ No se reconoció ningún movimiento válido";
    hablar("No se reconoció ningún movimiento válido");
  }
};

// --------------------------------------------------
// Listeners para sincronización y eventos (control_carrito puede usar lo mismo)
window.addEventListener("storage", (ev) => {
  // si otra pestaña escribió la clave de sincronización, reaccionamos
  if (ev.key === "ultimoMovimientoSync" && ev.newValue) {
    try {
      const obj = JSON.parse(ev.newValue);
      console.log("storage sync recibido:", obj);
      // agregar al historial visual con la fecha que venga
      if (obj?.movimiento) agregarHistorial(obj.movimiento, obj.ts);
      // despachar evento local para UI interna:
      window.dispatchEvent(new CustomEvent("movimientoGuardado", { detail: obj }));
    } catch (e) { console.warn(e); }
  }
});

// --------------------------------------------------
// Si quieres que la propia página reaccione al CustomEvent (ejemplo: resaltar un icono)
window.addEventListener("movimientoGuardado", (e) => {
  // e.detail contiene { id_movimiento, fecha, movimiento }
  console.log("Evento movimientoGuardado en esta ventana:", e.detail);
  // aquí podrías actualizar UI local si lo deseas
});

// --------------------------------------------------
// Fin del archivo
// --------------------------------------------------


