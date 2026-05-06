let db = null;
let todosLosRegistros = [];

const solicitud = indexedDB.open("ProyectoPWD", 1);

solicitud.onupgradeneeded = (evento) => {
  const baseDeDatos = evento.target.result;

  const store = baseDeDatos.createObjectStore("registros", {
    keyPath: "id",
    autoIncrement: true,
  });

  store.createIndex("nombre", "nombre", { unique: false });

  console.log("Base de datos creada y object store configurado.");
};

solicitud.onsuccess = (evento) => {
  db = evento.target.result;
  actualizarEstado("connected", "Conectado a IndexedDB");
  cargarRegistros();
  console.log("Conexión exitosa a IndexedDB.");
};

solicitud.onerror = (evento) => {
  console.error("Error al abrir IndexedDB:", evento.target.error);
  actualizarEstado("error", "Error de conexión");
};

function guardar() {
  const nombre  = document.getElementById("inp-nombre").value.trim();
  const materia = document.getElementById("inp-materia").value.trim();
  const nota    = parseInt(document.getElementById("inp-nota").value, 10);
  const obs     = document.getElementById("inp-obs").value.trim();

  if (!nombre || !materia || isNaN(nota)) {
    parpadeaCamposVacios();
    return;
  }

  if (nota < 1 || nota > 10) {
    alert("La nota debe estar entre 1 y 10.");
    return;
  }

  const nuevoRegistro = {
    nombre,
    materia,
    nota,
    obs: obs || "—",
    fecha: new Date().toLocaleString("es-AR", {
      day:    "2-digit",
      month:  "2-digit",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    }),
  };

  const transaccion = db.transaction("registros", "readwrite");
  const store       = transaccion.objectStore("registros");
  const operacion   = store.add(nuevoRegistro);

  operacion.onsuccess = () => {
    limpiarFormulario();
    mostrarFeedback("✓ Guardado correctamente");
    cargarRegistros();
    console.log("Registro guardado:", nuevoRegistro);
  };

  operacion.onerror = (e) => {
    console.error("Error al guardar:", e.target.error);
  };
}

function cargarRegistros() {
  const transaccion = db.transaction("registros", "readonly");
  const store       = transaccion.objectStore("registros");
  const solicitudLeer = store.getAll();

  solicitudLeer.onsuccess = (evento) => {
    todosLosRegistros = evento.target.result;
    renderizarTabla(todosLosRegistros);
    actualizarEstadisticas(todosLosRegistros);
  };

  solicitudLeer.onerror = (e) => {
    console.error("Error al leer registros:", e.target.error);
  };
}

/**
 * Borra un registro específico usando su ID (clave primaria).
 * @param {number} id - ID del registro a eliminar
 */
function borrarUno(id) {
  const transaccion = db.transaction("registros", "readwrite");
  const store       = transaccion.objectStore("registros");
  store.delete(id);

  transaccion.oncomplete = () => {
    cargarRegistros();
    console.log(`🗑️ Registro ${id} eliminado.`);
  };
}


function borrarTodo() {
  if (!confirm("¿Seguro que querés borrar todos los registros? Esta acción no se puede deshacer.")) return;

  const transaccion = db.transaction("registros", "readwrite");
  const store       = transaccion.objectStore("registros");
  store.clear(); // Equivale a DELETE FROM registros en SQL

  transaccion.oncomplete = () => {
    cargarRegistros();
    console.log("🗑️ Todos los registros eliminados.");
  };
}

function filtrar() {
  const query = document.getElementById("inp-filtro").value.toLowerCase().trim();

  if (!query) {
    renderizarTabla(todosLosRegistros);
    return;
  }

  const filtrados = todosLosRegistros.filter((r) =>
    r.nombre.toLowerCase().includes(query) ||
    r.materia.toLowerCase().includes(query)
  );

  renderizarTabla(filtrados);
}
/**
 * Genera las filas de la tabla a partir de un array de registros.
 * @param {Array} registros - Array de objetos a mostrar
 */
function renderizarTabla(registros) {
  const tbody      = document.getElementById("tabla-body");
  const emptyState = document.getElementById("empty-state");
  const tabla      = document.querySelector(".records-table");

  if (!registros.length) {
    tabla.style.display  = "none";
    emptyState.style.display = "flex";
    return;
  }

  tabla.style.display      = "table";
  emptyState.style.display = "none";

  // Construir filas con template literals
  tbody.innerHTML = registros.map((r, index) => `
    <tr class="${index === registros.length - 1 ? "new-row" : ""}">
      <td>${r.id}</td>
      <td class="td-nombre">${escaparHTML(r.nombre)}</td>
      <td>${escaparHTML(r.materia)}</td>
      <td class="td-nota">
        <span class="badge-nota ${badgeClase(r.nota)}">${r.nota}</span>
      </td>
      <td class="td-fecha">${r.fecha}</td>
      <td class="td-obs" title="${escaparHTML(r.obs)}">${escaparHTML(r.obs)}</td>
      <td>
        <button class="btn-icon" onclick="borrarUno(${r.id})" title="Eliminar registro">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join("");
}

/**
 * Determina la clase CSS del badge según la nota.
 * @param {number} nota
 * @returns {string} clase CSS
 */
function badgeClase(nota) {
  if (nota >= 8) return "alta";
  if (nota >= 6) return "media";
  return "baja";
}

/**
 * Escapa caracteres HTML para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
function escaparHTML(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

function limpiarFormulario() {
  ["inp-nombre", "inp-materia", "inp-nota", "inp-obs"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("inp-nombre").focus();
}

/**
 * Muestra un mensaje de feedback temporal.
 * @param {string} mensaje
 */
function mostrarFeedback(mensaje) {
  const el = document.getElementById("save-feedback");
  el.textContent = mensaje;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

/**
 * Actualiza el indicador de estado de la DB en el sidebar.
 * @param {string} clase   - "connected" | "error"
 * @param {string} mensaje - Texto a mostrar
 */
function actualizarEstado(clase, mensaje) {
  document.getElementById("status-dot").className  = `status-dot ${clase}`;
  document.getElementById("status-text").textContent = mensaje;
}

/**
 * Actualiza las estadísticas del sidebar (total y último guardado).
 * @param {Array} registros
 */
function actualizarEstadisticas(registros) {
  document.getElementById("total-count").textContent = registros.length;

  if (registros.length > 0) {
    const ultimo = registros[registros.length - 1];
    // Mostrar solo HH:MM del último registro
    const hora = ultimo.fecha.split(" ").pop();
    document.getElementById("last-saved").textContent = hora;
  } else {
    document.getElementById("last-saved").textContent = "—";
  }
}

function parpadeaCamposVacios() {
  const campos = ["inp-nombre", "inp-materia", "inp-nota"];
  campos.forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = "#ff4d6d";
      el.style.boxShadow   = "0 0 0 3px rgba(255,77,109,0.15)";
      setTimeout(() => {
        el.style.borderColor = "";
        el.style.boxShadow   = "";
      }, 1500);
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    const activo = document.activeElement;
    const campos = ["inp-nombre", "inp-materia", "inp-nota", "inp-obs"];
    if (campos.includes(activo.id)) {
      guardar();
    }
  }
});