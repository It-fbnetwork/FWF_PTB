const code = window.location.pathname.split("/").filter(Boolean).pop()?.toUpperCase() ?? "";
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");
const leadEl = document.getElementById("lead");
const titleEl = document.getElementById("title");
const photoEl = document.getElementById("photo");
const photoPlaceholderEl = document.getElementById("photo-placeholder");
const actionsEl = document.getElementById("actions");
const downloadEl = document.getElementById("download");
const shareEl = document.getElementById("share");
const shareFeedbackEl = document.getElementById("share-feedback");
const frameStepEl = document.getElementById("frame-step");
const frameLoadingEl = document.getElementById("frame-loading");
const captureButtonEl = document.getElementById("capture-button");
const captureStatusEl = document.getElementById("capture-status");
let refreshInFlight = false;
let currentPhotoUrl = "";
let shareFeedbackTimer;

if (
  !(statusEl instanceof HTMLElement) ||
  !(nameEl instanceof HTMLElement) ||
  !(leadEl instanceof HTMLElement) ||
  !(titleEl instanceof HTMLElement) ||
  !(photoEl instanceof HTMLImageElement) ||
  !(photoPlaceholderEl instanceof HTMLElement) ||
  !(actionsEl instanceof HTMLElement) ||
  !(downloadEl instanceof HTMLAnchorElement) ||
  !(shareEl instanceof HTMLButtonElement) ||
  !(shareFeedbackEl instanceof HTMLElement) ||
  !(frameStepEl instanceof HTMLElement) ||
  !(frameLoadingEl instanceof HTMLElement) ||
  !(captureButtonEl instanceof HTMLButtonElement) ||
  !(captureStatusEl instanceof HTMLElement)
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
  captureButtonEl.disabled = session.status !== "READY" && session.status !== "SELECTED";
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
    currentPhotoUrl = selected.url;
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
    currentPhotoUrl = "";
  }
}

function showShareFeedback(message) {
  window.clearTimeout(shareFeedbackTimer);
  shareFeedbackEl.textContent = message;
  shareFeedbackEl.hidden = false;
  shareFeedbackTimer = window.setTimeout(() => {
    shareFeedbackEl.hidden = true;
  }, 2400);
}

async function copyPhotoLink(url) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const input = document.createElement("textarea");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Không thể sao chép đường dẫn ảnh");
}

shareEl.addEventListener("click", async () => {
  if (!currentPhotoUrl) return;
  shareEl.disabled = true;
  try {
    if (navigator.share) {
      await navigator.share({
        title: "Ảnh Face Wash Fox",
        text: "Khoảnh khắc của tôi tại Face Wash Fox",
        url: currentPhotoUrl,
      });
      return;
    }

    await copyPhotoLink(currentPhotoUrl);
    showShareFeedback("Đã sao chép đường dẫn ảnh");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    try {
      await copyPhotoLink(currentPhotoUrl);
      showShareFeedback("Đã sao chép đường dẫn ảnh");
    } catch {
      showShareFeedback("Không thể chia sẻ ảnh trên trình duyệt này");
    }
  } finally {
    shareEl.disabled = false;
  }
});

async function previewFrame(frameId) {
  const res = await fetch("/api/display/frame-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frameId }),
  });
  if (!res.ok) throw new Error("Không thể gửi frame sang màn hình display");
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
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
  const res = await fetch(`/api/sessions/code/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Không tìm thấy phiên check-in");
  const json = await res.json();
  render(json.session);
  } finally {
    refreshInFlight = false;
  }
}

await refresh();
const initialFrameInput = frameStepEl.querySelector('input[name="selectedFrameId"]:checked');
if (initialFrameInput instanceof HTMLInputElement) {
  void previewFrame(initialFrameInput.value).catch((error) => {
    console.warn("Initial frame preview failed", error);
  });
}
setInterval(() => {
  void refresh().catch((error) => {
    console.warn("Session refresh failed", error);
  });
}, 2000);
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

captureButtonEl.addEventListener("click", async () => {
  captureButtonEl.disabled = true;
  captureStatusEl.textContent = "Chuẩn bị chụp: 3… 2… 1…";
  try {
    const res = await fetch(`/api/sessions/code/${encodeURIComponent(code)}/capture`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Không thể gửi lệnh chụp");
    captureStatusEl.textContent = "Đã gửi lệnh chụp. Vui lòng nhìn vào camera!";
    window.setTimeout(() => {
      captureStatusEl.textContent = "Đang xử lý ảnh…";
    }, 3500);
  } catch (error) {
    captureStatusEl.textContent = error instanceof Error ? error.message : String(error);
    captureButtonEl.disabled = false;
  }
});

const source = new EventSource(`/api/events?code=${encodeURIComponent(code)}`);
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
