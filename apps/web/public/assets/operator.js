const activeEl = document.getElementById("active");
const queueEl = document.getElementById("queue");
const recentEl = document.getElementById("recent");
const emptyEl = document.getElementById("empty");
const historyEl = document.getElementById("history");
const historyEmptyEl = document.getElementById("history-empty");
const historyCountEl = document.getElementById("history-count");
const waitingCountEl = document.getElementById("waiting-count");
const historyTabCountEl = document.getElementById("history-tab-count");
const waitingPanelEl = document.getElementById("waiting-panel");
const historyPanelEl = document.getElementById("history-panel");
const waitingTabEl = document.getElementById("waiting-tab");
const historyTabEl = document.getElementById("history-tab");
const photoModal = document.getElementById("photo-modal");
const photoModalTitle = document.getElementById("photo-modal-title");
const photoModalSub = document.getElementById("photo-modal-sub");
const photoModalBody = document.getElementById("photo-modal-body");

if (
  !(activeEl instanceof HTMLElement) ||
  !(queueEl instanceof HTMLElement) ||
  !(recentEl instanceof HTMLElement) ||
  !(emptyEl instanceof HTMLElement) ||
  !(historyEl instanceof HTMLElement) ||
  !(historyEmptyEl instanceof HTMLElement) ||
  !(historyCountEl instanceof HTMLElement) ||
  !(waitingCountEl instanceof HTMLElement) ||
  !(historyTabCountEl instanceof HTMLElement) ||
  !(waitingPanelEl instanceof HTMLElement) ||
  !(historyPanelEl instanceof HTMLElement) ||
  !(waitingTabEl instanceof HTMLButtonElement) ||
  !(historyTabEl instanceof HTMLButtonElement) ||
  !(photoModal instanceof HTMLElement) ||
  !(photoModalTitle instanceof HTMLElement) ||
  !(photoModalSub instanceof HTMLElement) ||
  !(photoModalBody instanceof HTMLElement)
) {
  throw new Error("Operator DOM incomplete");
}

const PIN_KEY = "fwf_operator_pin";
const TAB_KEY = "fwf_operator_tab";

function setActiveTab(tab) {
  const activeTab = tab === "history" ? "history" : "waiting";
  const showHistory = activeTab === "history";
  waitingPanelEl.hidden = showHistory;
  historyPanelEl.hidden = !showHistory;
  waitingTabEl.classList.toggle("is-active", !showHistory);
  historyTabEl.classList.toggle("is-active", showHistory);
  waitingTabEl.setAttribute("aria-selected", String(!showHistory));
  historyTabEl.setAttribute("aria-selected", String(showHistory));
  sessionStorage.setItem(TAB_KEY, activeTab);
}

setActiveTab(sessionStorage.getItem(TAB_KEY));

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

function selectedPhotos(session) {
  const photos = Array.isArray(session.photos) ? session.photos : [];
  return photos;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function renderHistory() {
  const entries = snapshot.sessions
    .flatMap((session) =>
      (Array.isArray(session.photos) ? session.photos : []).map((photo) => ({ session, photo })),
    )
    .sort((a, b) => new Date(b.photo.createdAt).getTime() - new Date(a.photo.createdAt).getTime());

  historyEmptyEl.hidden = entries.length > 0;
  historyEmptyEl.textContent = "Chưa có ảnh nào được chụp.";
  historyCountEl.hidden = entries.length === 0;
  historyCountEl.textContent = `${entries.length} ẢNH`;
  historyTabCountEl.textContent = String(entries.length);
  historyEl.innerHTML = entries
    .map(({ session, photo }) => {
      const label = photo.processedFilename || "fwf-photo.jpg";
      return `
        <article class="history-card">
          <button class="history-card__preview" type="button" data-action="view-photos" data-id="${session.id}" aria-label="Xem ảnh của ${escapeHtml(session.name)}">
            <img src="${escapeHtml(photo.url)}" alt="Ảnh của ${escapeHtml(session.name)}" loading="lazy" />
          </button>
          <div class="history-card__body">
            <span class="queue-name history-card__name">${escapeHtml(session.name)}</span>
            <span class="queue-sub">${escapeHtml(session.phone)} · ${escapeHtml(session.code)}</span>
            <span class="queue-sub">${escapeHtml(formatDate(photo.createdAt))}</span>
            <div class="btn-row history-card__actions">
              <button class="btn btn--ghost" type="button" data-action="view-photos" data-id="${session.id}">XEM</button>
              <button class="btn" type="button" data-action="download-photo" data-photo-id="${photo.id}" data-filename="${escapeHtml(label)}">TẢI ẢNH</button>
              <button class="btn btn--danger" type="button" data-action="delete-photo" data-photo-id="${photo.id}" data-filename="${escapeHtml(label)}" data-customer="${escapeHtml(session.name)}">XÓA</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function viewPhotoButton(session) {
  if (!session.photos?.length) return "";
  return `<button class="btn btn--ghost" data-action="view-photos" data-id="${session.id}">XEM ẢNH (${session.photos.length})</button>`;
}

function openPhotoModal(session) {
  const photos = selectedPhotos(session);
  if (photos.length === 0) {
    alert("Session này chưa có ảnh.");
    return;
  }

  photoModalTitle.textContent = `Ảnh · ${session.code}`;
  photoModalSub.textContent = `${session.name} · ${session.phone}`;
  photoModalBody.innerHTML = photos
    .map((photo, index) => {
      const label = photo.processedFilename || `Ảnh ${index + 1}`;
      return `
        <article class="photo-modal__item">
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(label)}" />
          <div class="photo-modal__meta">
            <span class="queue-sub">${escapeHtml(label)}</span>
            <div class="btn-row">
              <a class="btn btn--ghost" href="${escapeHtml(photo.url)}" target="_blank" rel="noopener">MỞ</a>
              <button class="btn" type="button" data-action="download-photo" data-photo-id="${photo.id}" data-filename="${escapeHtml(label)}">TẢI ẢNH</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  photoModal.hidden = false;
}

function closePhotoModal() {
  photoModal.hidden = true;
  photoModalBody.innerHTML = "";
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
          ${viewPhotoButton(session)}
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
  if (session.photos?.length) {
    actions.push(viewPhotoButton(session));
  }
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
        <span class="queue-sub">${escapeHtml(session.phone)}${session.photos?.length ? ` · ${session.photos.length} ảnh` : ""}</span>
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
  renderHistory();

  const waiting = snapshot.sessions.filter((s) => s.status === "WAITING");
  const others = snapshot.sessions.filter((s) => s.status !== "WAITING").slice(0, 20);

  emptyEl.hidden = waiting.length > 0;
  waitingCountEl.textContent = String(waiting.length);
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

function showRefreshError(error) {
  const message = error instanceof Error ? error.message : String(error);
  historyEl.innerHTML = "";
  historyCountEl.hidden = true;
  historyEmptyEl.hidden = false;
  historyEmptyEl.textContent = `Không tải được lịch sử: ${message}`;
}

document.addEventListener("click", async (event) => {
  const eventTarget = event.target;
  if (!(eventTarget instanceof HTMLElement)) return;
  const target = eventTarget.closest("[data-action]") ?? eventTarget;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.action === "close-modal") {
    closePhotoModal();
    return;
  }

  if (target.dataset.action === "switch-tab") {
    setActiveTab(target.dataset.tab);
    return;
  }

  if (target.dataset.action === "download-photo") {
    const photoId = target.dataset.photoId;
    if (!photoId) return;
    target.setAttribute("disabled", "true");
    const originalText = target.textContent;
    target.textContent = "ĐANG TẢI...";
    try {
      const pin = getPin();
      const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}/download`, {
        headers: { "x-operator-pin": pin },
      });
      if (res.status === 401) sessionStorage.removeItem(PIN_KEY);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Không tải được ảnh");
      }
      const blobUrl = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = target.dataset.filename || "fwf-photo.jpg";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      target.removeAttribute("disabled");
      target.textContent = originalText;
    }
    return;
  }

  if (target.dataset.action === "delete-photo") {
    const photoId = target.dataset.photoId;
    if (!photoId) return;
    const filename = target.dataset.filename || "ảnh này";
    const customer = target.dataset.customer || "khách";
    const confirmed = window.confirm(
      `Xóa vĩnh viễn ${filename} của ${customer}?\n\nẢnh sẽ bị xóa khỏi lịch sử và Cloudflare R2. Thao tác này không thể hoàn tác.`,
    );
    if (!confirmed) return;

    target.setAttribute("disabled", "true");
    const originalText = target.textContent;
    target.textContent = "ĐANG XÓA...";
    try {
      await api(`/api/photos/${encodeURIComponent(photoId)}`, "DELETE");
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
      target.removeAttribute("disabled");
      target.textContent = originalText;
    }
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  if (action === "view-photos") {
    const session = snapshot.sessions.find((s) => s.id === id) ?? snapshot.activeSession;
    if (!session || session.id !== id) {
      alert("Không tìm thấy session.");
      return;
    }
    openPhotoModal(session);
    return;
  }

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

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !photoModal.hidden) closePhotoModal();
});

try {
  await refresh();
} catch (error) {
  showRefreshError(error);
}
setInterval(() => {
  void refresh().catch(showRefreshError);
}, 2500);
