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
const framePreviewLiveEl = document.getElementById("frame-preview-live");
const framePreviewImageEl = document.getElementById("frame-preview-image");
const cameraStatusEl = document.getElementById("camera-status");
let refreshInFlight = false;
let cameraStream = null;

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
  !(frameLoadingEl instanceof HTMLElement) ||
  !(framePreviewLiveEl instanceof HTMLVideoElement) ||
  !(framePreviewImageEl instanceof HTMLImageElement) ||
  !(cameraStatusEl instanceof HTMLElement)
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
  framePreviewImageEl.src = `/frames/${selectedFrameId}.png`;
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

function setCameraStatus(message) {
  cameraStatusEl.textContent = message;
  cameraStatusEl.hidden = !message;
}

async function startCameraPreview() {
  if (cameraStream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("Trinh duyet khong ho tro xem truoc camera.");
    return;
  }

  try {
    setCameraStatus("Dang mo camera...");
    const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    probe.getTracks().forEach((track) => track.stop());

    const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
      (device) => device.kind === "videoinput",
    );
    const cameraQuery = new URLSearchParams(window.location.search).get("camera")?.trim();
    const preferred = inputs.find((device) =>
      cameraQuery
        ? device.label.toLowerCase().includes(cameraQuery.toLowerCase())
        : /cam link|sony|zv|e10|usb|capture|uvc/i.test(device.label),
    );
    const deviceId = preferred?.deviceId ?? inputs[0]?.deviceId;

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    });
    framePreviewLiveEl.srcObject = cameraStream;
    await framePreviewLiveEl.play();
    setCameraStatus("");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setCameraStatus(message || "Khong mo duoc camera.");
  }
}

function stopCameraPreview() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  framePreviewLiveEl.srcObject = null;
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
void startCameraPreview();
setInterval(() => {
  void refresh().catch((error) => {
    console.warn("Session refresh failed", error);
  });
}, 2000);
window.addEventListener("pagehide", stopCameraPreview);

frameStepEl.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.name === "selectedFrameId") {
    void updateFrame(target.value).catch((error) => {
      console.warn("Frame update failed", error);
    });
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
