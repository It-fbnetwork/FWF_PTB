const activeEl = document.getElementById("active");
const queueEl = document.getElementById("queue");
const recentEl = document.getElementById("recent");
const emptyEl = document.getElementById("empty");

if (
  !(activeEl instanceof HTMLElement) ||
  !(queueEl instanceof HTMLElement) ||
  !(recentEl instanceof HTMLElement) ||
  !(emptyEl instanceof HTMLElement)
) {
  throw new Error("Operator DOM incomplete");
}

const PIN_KEY = "fwf_operator_pin";

function getPin() {
  let pin = sessionStorage.getItem(PIN_KEY);
  if (!pin) {
    pin = window.prompt("Nhập Operator PIN") ?? "";
    if (pin) sessionStorage.setItem(PIN_KEY, pin);
  }
  return pin;
}

/** @type {{ activeSessionId: string | null, activeSession: any, sessions: any[] }} */
let snapshot = { activeSessionId: null, activeSession: null, sessions: [] };

async function api(path, method = "GET") {
  const pin = getPin();
  const res = await fetch(path, {
    method,
    headers: { "x-operator-pin": pin },
  });
  const json = await res.json();
  if (res.status === 401) {
    sessionStorage.removeItem(PIN_KEY);
    throw new Error("Sai Operator PIN");
  }
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function pill(status) {
  const cls =
    status === "READY" || status === "SELECTED"
      ? "is-ready"
      : status === "READY_TO_DISPLAY" || status === "COMPLETED"
        ? "is-done"
        : "";
  return `<span class="status-pill ${cls}">${status}</span>`;
}

function renderActive(session) {
  if (session) {
    activeEl.hidden = false;
    activeEl.innerHTML = `
      <div class="queue-meta">
        <strong>ACTIVE SESSION</strong>
        <span class="queue-code">${session.code}</span>
        <span class="queue-name">${escapeHtml(session.name)}</span>
        <span class="queue-sub">${escapeHtml(session.phone)} · ${session.photos.length} photo(s)</span>
        <div style="margin-top:0.55rem">${pill(session.status)}</div>
        <div class="btn-row" style="margin-top:0.8rem">
          <button class="btn btn--ghost" data-action="complete" data-id="${session.id}">COMPLETE</button>
          <button class="btn btn--danger" data-action="cancel" data-id="${session.id}">CANCEL</button>
        </div>
      </div>
    `;
    return;
  }

  const waitingCount = snapshot.sessions.filter((s) => s.status === "WAITING").length;
  if (waitingCount > 0) {
    activeEl.hidden = false;
    activeEl.innerHTML = `
      <div class="queue-meta">
        <strong>CHƯA CÓ ACTIVE SESSION</strong>
        <span class="queue-sub">Bấm PREPARE PHOTO trên khách trong hàng chờ trước khi chụp.</span>
      </div>
    `;
    return;
  }

  activeEl.hidden = true;
  activeEl.innerHTML = "";
}

function renderItem(session, { showPrepare }) {
  const isActive = snapshot.activeSessionId === session.id;
  const actions = [];
  if (showPrepare) {
    actions.push(`<button class="btn" data-action="prepare" data-id="${session.id}">PREPARE PHOTO</button>`);
  }
  if (session.status === "READY" || session.status === "READY_TO_DISPLAY" || session.status === "CAPTURED") {
    actions.push(`<button class="btn btn--ghost" data-action="complete" data-id="${session.id}">COMPLETE</button>`);
  }
  if (session.status !== "CANCELLED" && session.status !== "COMPLETED") {
    actions.push(`<button class="btn btn--danger" data-action="cancel" data-id="${session.id}">CANCEL</button>`);
  }

  return `
    <article class="queue-item ${isActive ? "is-active" : ""}">
      <div class="queue-meta">
        <span class="queue-code">${session.code}</span>
        <span class="queue-name">${escapeHtml(session.name)}</span>
        <span class="queue-sub">${escapeHtml(session.phone)}</span>
        <div>${pill(session.status)}</div>
      </div>
      <div class="btn-row">${actions.join("")}</div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function canPrepare(session) {
  return (
    session.status === "WAITING" ||
    session.status === "READY" ||
    session.status === "SELECTED" ||
    session.status === "READY_TO_DISPLAY" ||
    session.status === "CAPTURED"
  );
}

function render() {
  renderActive(snapshot.activeSession);

  const waiting = snapshot.sessions.filter((s) => s.status === "WAITING");
  const others = snapshot.sessions.filter((s) => s.status !== "WAITING").slice(0, 20);

  emptyEl.hidden = waiting.length > 0;
  queueEl.innerHTML = waiting.map((s) => renderItem(s, { showPrepare: true })).join("");
  recentEl.innerHTML =
    others.length > 0
      ? others.map((s) => renderItem(s, { showPrepare: canPrepare(s) })).join("")
      : `<p class="empty">Chưa có session gần đây.</p>`;
}

async function refresh() {
  snapshot = await api("/api/sessions");
  render();
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  target.setAttribute("disabled", "true");
  try {
    if (action === "prepare") await api(`/api/sessions/${id}/prepare`, "POST");
    if (action === "complete") await api(`/api/sessions/${id}/complete`, "POST");
    if (action === "cancel") await api(`/api/sessions/${id}/cancel`, "POST");
    await refresh();
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  } finally {
    target.removeAttribute("disabled");
  }
});

await refresh();
setInterval(() => {
  void refresh().catch(() => undefined);
}, 2500);
