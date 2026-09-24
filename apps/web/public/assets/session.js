const code = window.location.pathname.split("/").filter(Boolean).pop()?.toUpperCase() ?? "";
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");
const leadEl = document.getElementById("lead");
const titleEl = document.getElementById("title");
const photoEl = document.getElementById("photo");
const photoPlaceholderEl = document.getElementById("photo-placeholder");
const actionsEl = document.getElementById("actions");
const downloadEl = document.getElementById("download");
const frameStepEl = document.getElementById("frame-step");
const frameLoadingEl = document.getElementById("frame-loading");

if (
  !(statusEl instanceof HTMLElement) ||
  !(nameEl instanceof HTMLElement) ||
  !(leadEl instanceof HTMLElement) ||
  !(titleEl instanceof HTMLElement) ||
  !(photoEl instanceof HTMLImageElement) ||
  !(photoPlaceholderEl instanceof HTMLElement) ||
  !(actionsEl instanceof HTMLElement) ||
  !(downloadEl instanceof HTMLAnchorElement) ||
  !(frameStepEl instanceof HTMLElement) ||
  !(frameLoadingEl instanceof HTMLElement)
) {
  throw new Error("Session DOM incomplete");
}

function setFrameLoading(isLoading) {
  frameLoadingEl.hidden = !isLoading;
  frameStepEl.classList.toggle("is-loading", isLoading);
  frameStepEl.querySelectorAll('input[name="selectedFrameId"]').forEach((input) => {
    if (input instanceof HTMLInputElement) input.disabled = isLoading;
  });
}

function statusClass(status) {
  if (status === "READY" || status === "SELECTED") return "is-ready";
  if (status === "READY_TO_DISPLAY" || status === "COMPLETED" || status === "DISPLAYING") return "is-done";
  return "";
}

function render(session) {
  statusEl.textContent = session.status;
  statusEl.className = `status-pill ${statusClass(session.status)}`;
  nameEl.innerHTML = `<span class="guest-owner__label">Ảnh này của</span> <span class="guest-owner__name">${session.name}</span>`;
  const selectedFrameId = session.selectedFrameId || "frame-1";
  const selectedFrameInput = frameStepEl.querySelector(
    `input[name="selectedFrameId"][value="${CSS.escape(selectedFrameId)}"]`,
  );
  if (selectedFrameInput instanceof HTMLInputElement) {
    selectedFrameInput.checked = true;
  }

  const selected =
    session.photos.find((p) => p.id === session.selectedPhotoId) ??
    session.photos[session.photos.length - 1];
  frameStepEl.hidden = Boolean(selected?.url);

  if (session.status === "WAITING") {
    titleEl.hidden = true;
    titleEl.textContent = "CHECK-IN THÀNH CÔNG";
    leadEl.textContent = "Fox Studio đã sẵn sàng, mời Foxie đến khu vực chụp hình để thả dáng!";
  } else if (session.status === "READY" || session.status === "SELECTED") {
    titleEl.hidden = true;
    titleEl.textContent = "CHECK-IN THÀNH CÔNG";
    leadEl.textContent = "Fox Studio đã sẵn sàng, mời Foxie đến khu vực chụp hình để thả dáng!";
  } else if (session.status === "PROCESSING" || session.status === "CAPTURED") {
    titleEl.hidden = false;
    titleEl.textContent = "ĐANG XỬ LÝ";
    leadEl.textContent = "Ảnh của bạn đang được ghép frame Face Wash Fox…";
    frameStepEl.hidden = true;
  } else {
    titleEl.hidden = false;
    titleEl.textContent = "YOUR FWF MOMENT";
    leadEl.textContent = "Ảnh Face Wash Fox của bạn đã sẵn sàng.";
  }

  if (selected?.url) {
    photoPlaceholderEl.hidden = true;
    photoEl.hidden = false;
    photoEl.src = selected.url;
    actionsEl.hidden = false;
    downloadEl.href = selected.url;
    downloadEl.download = selected.processedFilename || "fwf-photo.jpg";
    if (
      session.status === "READY_TO_DISPLAY" ||
      session.status === "DISPLAYING" ||
      session.status === "COMPLETED"
    ) {
      frameStepEl.hidden = true;
    }
  } else {
    photoPlaceholderEl.hidden = false;
    photoEl.hidden = true;
    photoEl.removeAttribute("src");
    actionsEl.hidden = true;
  }
}

async function previewFrame(frameId) {
  await fetch("/api/display/frame-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frameId }),
  });
}

function clearFramePreview() {
  const body = JSON.stringify({ action: "clear" });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/display/frame-preview", blob)) return;
  void fetch("/api/display/frame-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

async function updateFrame(frameId) {
  setFrameLoading(true);
  try {
    const res = await fetch(`/api/sessions/code/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedFrameId: frameId }),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(json.error || "Không thể chọn frame");
    render(json.session);
    await previewFrame(frameId);
  } finally {
    setFrameLoading(false);
  }
}

async function refresh() {
  const res = await fetch(`/api/sessions/code/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Không tìm thấy phiên check-in");
  const json = await res.json();
  render(json.session);
}

await refresh();
window.addEventListener("pagehide", clearFramePreview);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") clearFramePreview();
});

frameStepEl.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.name === "selectedFrameId") {
    void updateFrame(target.value).catch((error) => {
      console.warn("Frame update failed", error);
    });
  }
});

const source = new EventSource("/api/events");
source.addEventListener("session_event", async (message) => {
  try {
    const event = JSON.parse(message.data);
    if (event?.session?.code === code) {
      render(event.session);
    }
  } catch {
    await refresh();
  }
});
source.addEventListener("photo_ready", async (message) => {
  try {
    const event = JSON.parse(message.data);
    if (event?.sessionCode === code) await refresh();
  } catch {
    // ignore
  }
});
