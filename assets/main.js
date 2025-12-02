// === Config ===
const API_BASE = "http://52.72.153.166:5500/api";

// Catálogo local
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

// === DOM refs (se asignan en DOMContentLoaded) ===
let statusEl, tsEl, btnVerUltimos, btnClear, estadoMovimientosEl, tablaUltimosBody;
let pollingInterval = null;

// === Helpers sessionStorage (conteo por sesión) ===
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
function sessionCount() {
  return getSessionMovs().length;
}

// === API calls ===
async function postMovimiento(id_movimiento) {
  const res = await fetch(`${API_BASE}/movimientos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_movimiento }),
  });
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.json();
}

async function getUltimoMovimiento() {
  const res = await fetch(`${API_BASE}/movimientos/ultimo`);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.json();
}

async function getUltimosN(n = 5) {
  const res = await fetch(`${API_BASE}/movimientos/ultimos?n=${n}`);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.json();
}

// === UI helpers ===
function setStatus(texto, fecha = null) {
  if (!statusEl) return;
  statusEl.textContent = (texto || "—").toUpperCase();
  tsEl.textContent = fecha ? new Date(fecha).toLocaleString() : "";
}
function showToast(msg) {
  // simple fallback: console + small visual update
  console.log("[toast]", msg);
  estadoMovimientosEl.textContent = msg;
}

// Añade clase .blink al botón presionado para el efecto visual
function animateButton(idMov) {
  const btn = document.querySelector(`[data-mov="${idMov}"]`);
  if (!btn) return;
  // alterna blink / blink-right para simular dirección
  btn.classList.add("blink");
  const rightSide = [4,6,8,10]; // movimientos de "derecha"
  if (rightSide.includes(Number(idMov))) btn.classList.add("blink-right");
  setTimeout(() => {
    btn.classList.remove("blink");
    btn.classList.remove("blink-right");
  }, 1400);
}

// Estado dinámico de la sección "Últimos 5 Movimientos"
function updateEstadoMovimientos() {
  const cnt = sessionCount();
  if (cnt >= 5) {
    estadoMovimientosEl.textContent = `✨ Ya hiciste 5 movimientos (sesión): ${cnt}/5`;
    estadoMovimientosEl.style.background = "linear-gradient(90deg,#7bdff6,#9ef0c9)";
    estadoMovimientosEl.style.color = "#00303a";
  } else {
    estadoMovimientosEl.textContent = `Aún no alcanzas 5 movimientos (sesión): ${cnt}/5`;
    estadoMovimientosEl.style.background = "transparent";
    estadoMovimientosEl.style.color = "#00e6e6";
  }
}

// === Lógica principal para enviar movimiento ===
async function enviarMovimiento(idMov) {
  try {
    // feedback visual inmediato
    setStatus(CATALOGO[idMov]);

    // guardar en sesión y animar botón
    pushSessionMov(idMov);
    animateButton(idMov);
    updateEstadoMovimientos();

    // guardar local para persistencia entre reloads
    localStorage.setItem("ultimoMovimiento", String(idMov));
    localStorage.setItem("ultimaFecha", new Date().toISOString());

    // enviar al backend
    const res = await postMovimiento(idMov);
    // si la API devuelve fecha la usamos
    const fechaApi = res?.data?.fecha_hora;
    if (fechaApi) localStorage.setItem("ultimaFecha", fechaApi);

    showToast(`Enviado: ${CATALOGO[idMov]}`);

    // actualizar último real desde la API
    await refrescarUltimo();

    // Si alcanzamos 5 movimientos, actualiza mensaje
    updateEstadoMovimientos();
  } catch (e) {
    console.error("Error enviarMovimiento:", e);
    showToast("Error al enviar movimiento");
  }
}

async function refrescarUltimo() {
  try {
    const resp = await getUltimoMovimiento();
    const data = resp?.data;
    if (data) {
      const movName = data.movimiento ?? CATALOGO[data.id_movimiento] ?? CATALOGO[data.id] ?? "Movimiento";
      const fecha = data.fecha_hora ?? data.created_at ?? null;
      setStatus(movName, fecha);
      if (data.id_movimiento) localStorage.setItem("ultimoMovimiento", String(data.id_movimiento));
      if (fecha) localStorage.setItem("ultimaFecha", fecha);
    } else {
      const ultimo = localStorage.getItem("ultimoMovimiento");
      const fecha = localStorage.getItem("ultimaFecha");
      if (ultimo) setStatus(CATALOGO[ultimo], fecha);
    }
  } catch (e) {
    console.warn("No se pudo consultar último movimiento:", e);
    const ultimo = localStorage.getItem("ultimoMovimiento");
    const fecha = localStorage.getItem("ultimaFecha");
    if (ultimo) setStatus(CATALOGO[ultimo], fecha);
  }
}

// === Cargar y mostrar últimos N movimientos en la tabla ===
async function cargarUltimosMovimientos() {
  try {
    // mostrar spinner en el botón
    const spinner = btnVerUltimos.querySelector(".spinner");
    if (spinner) spinner.hidden = false;

    const resp = await getUltimosN(5);
    const movimientos = resp?.data ?? resp ?? [];
    tablaUltimosBody.innerHTML = "";

    movimientos.forEach(mov => {
      const idVal = mov.id_movimiento ?? mov.id ?? "";
      const nombre = mov.movimiento ?? CATALOGO[idVal] ?? "Movimiento";
      const fecha = mov.fecha_hora ?? mov.created_at ?? "";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${idVal}</td><td>${nombre}</td><td>${fecha ? new Date(fecha).toLocaleString() : ""}</td>`;
      tablaUltimosBody.appendChild(tr);
    });

    updateEstadoMovimientos();
    if (spinner) spinner.hidden = true;
  } catch (err) {
    console.error("Error cargando últimos movimientos:", err);
    if (btnVerUltimos) {
      const spinner = btnVerUltimos.querySelector(".spinner");
      if (spinner) spinner.hidden = true;
    }
  }
}

// === Inicialización DOM ===
window.addEventListener("DOMContentLoaded", () => {
  statusEl = document.getElementById("ultimoMovimiento");
  tsEl = document.getElementById("fechaMovimiento");
  btnVerUltimos = document.getElementById("btnUltimos");
  btnClear = document.getElementById("btnClear");
  estadoMovimientosEl = document.getElementById("estadoMovimientos");
  tablaUltimosBody = document.querySelector("#tablaUltimos tbody");

  // restaurar último guardado en localStorage
  const ultimoGuardado = localStorage.getItem("ultimoMovimiento");
  const ultimaFecha = localStorage.getItem("ultimaFecha");
  if (ultimoGuardado) setStatus(CATALOGO[ultimoGuardado], ultimaFecha);

  // registrar botones de movimientos
  document.querySelectorAll("[data-mov]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.mov);
      if (!Number.isNaN(id)) enviarMovimiento(id);
    });
  });

  // teclado
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") e.preventDefault();
    const key = e.key.toLowerCase();
    if (key === "w") enviarMovimiento(1);
    if (key === "s") enviarMovimiento(2);
    if (e.code === "Space") enviarMovimiento(3);
    if (key === "e") enviarMovimiento(4);
    if (key === "q") enviarMovimiento(5);
    if (key === "c") enviarMovimiento(6);
    if (key === "z") enviarMovimiento(7);
    if (key === "d") enviarMovimiento(8);
    if (key === "a") enviarMovimiento(9);
    if (key === "x") enviarMovimiento(10);
    if (key === "y") enviarMovimiento(11);
  });

  // btn Ver últimos: carga y arranca polling cada 2s
  btnVerUltimos.addEventListener("click", () => {
    if (pollingInterval) {
      // si ya está poller, detener
      clearInterval(pollingInterval);
      pollingInterval = null;
      btnVerUltimos.textContent = "Ver últimos movimientos";
    } else {
      // iniciar
      cargarUltimosMovimientos();
      pollingInterval = setInterval(cargarUltimosMovimientos, 2000);
      btnVerUltimos.textContent = "Detener actualizaciones";
    }
  });

  // btn Clear: limpia tabla y session/local según pediste
  btnClear.addEventListener("click", () => {
    // detener polling si existiera
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; btnVerUltimos.textContent = "Ver últimos movimientos"; }
    // limpiar tabla y session
    tablaUltimosBody.innerHTML = "";
    clearSessionMovs();
    // opcional: solo limpiar sesión, no localStorage del último movimiento (ajusta si quieres)
    // localStorage.removeItem("ultimoMovimiento");
    // localStorage.removeItem("ultimaFecha");
    updateEstadoMovimientos();
    showToast("Datos de la sesión limpiados.");
  });

  // mostrar estado inicial (conteo sesión)
  updateEstadoMovimientos();
});
