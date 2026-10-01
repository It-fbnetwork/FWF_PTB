/** @typedef {{ displayDurationMs: number, fadeMs: number }} DisplayConfig */
/** @typedef {{ type: "PHOTO_READY", filename: string, url: string, createdAt: string }} PhotoReadyEvent */

const idleEl = document.getElementById("idle");
const photoEl = document.getElementById("photo");
const imageEl = document.getElementById("photo-image");
const framePreviewEl = document.getElementById("frame-preview");
const framePreviewLiveEl = document.getElementById("frame-preview-live");
const framePreviewImageEl = document.getElementById("frame-preview-image");
const cameraStatusEl = document.getElementById("camera-status");

if (
  !(idleEl instanceof HTMLElement) ||
  !(photoEl instanceof HTMLElement) ||
  !(imageEl instanceof HTMLImageElement) ||
  !(framePreviewEl instanceof HTMLElement) ||
  !(framePreviewLiveEl instanceof HTMLVideoElement) ||
  !(framePreviewImageEl instanceof HTMLImageElement) ||
  !(cameraStatusEl instanceof HTMLElement)
) {
  throw new Error("Display DOM is incomplete");
}

/** @type {PhotoReadyEvent[]} */
const queue = [];
let busy = false;
let displayDurationMs = 8000;
let fadeMs = 700;
let since = new Date(Date.now() - 5_000).toISOString();
const seen = new Set();
let cameraStream = null;
let cameraOpenAttempt = null;

console.info("FWF display direct camera build: direct-camera-4");

function setCameraStatus(message) {
  cameraStatusEl.textContent = message;
  cameraStatusEl.hidden = !message;
}

function configureLedCanvas() {
  const params = new URLSearchParams(window.location.search);
  const size = params.get("led") ?? params.get("size") ?? "";
  const sizeMatch = size.match(/^(\d{2,5})x(\d{2,5})$/i);
  const width = Number(params.get("w") ?? sizeMatch?.[1] ?? 86);
  const height = Number(params.get("h") ?? sizeMatch?.[2] ?? 172);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

  document.documentElement.style.setProperty("--led-w", String(width));
  document.documentElement.style.setProperty("--led-h", String(height));
  document.documentElement.dataset.ledCanvas = `${width}x${height}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function preload(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to preload ${url}`));
    img.src = url;
  });
}

async function fadeToIdle() {
  photoEl.classList.remove("is-visible");
  framePreviewEl.classList.remove("is-visible");
  await sleep(fadeMs);
  photoEl.hidden = true;
  framePreviewEl.hidden = true;
  imageEl.removeAttribute("src");
  framePreviewImageEl.removeAttribute("src");
  idleEl.hidden = false;
  idleEl.classList.add("is-visible");
}

async function fadeOutPhoto() {
  photoEl.classList.remove("is-visible");
  await sleep(fadeMs);
}

async function showPhoto(url) {
  await preload(url);
  imageEl.src = url;
  photoEl.hidden = false;
  framePreviewEl.classList.remove("is-visible");
  idleEl.classList.remove("is-visible");
  void photoEl.offsetWidth;
  photoEl.classList.add("is-visible");
  await sleep(fadeMs);
}

async function showFramePreview(frameUrl) {
  if (busy) return;
  await preload(frameUrl);
  void ensureCameraStream();
  framePreviewImageEl.src = frameUrl;
  framePreviewEl.hidden = false;
  photoEl.classList.remove("is-visible");
  idleEl.classList.remove("is-visible");
  void framePreviewEl.offsetWidth;
  framePreviewEl.classList.add("is-visible");
}

async function findVideoDevice() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((device) => device.kind === "videoinput");
  const labels = videoInputs.map((device) => device.label || "(camera without permission)");
  console.info("FWF camera inputs:", labels);
  const cameraQuery = new URLSearchParams(window.location.search).get("camera")?.trim();
  const preferred = videoInputs.find((device) =>
    cameraQuery
      ? device.label.toLowerCase().includes(cameraQuery.toLowerCase())
      : /cam link|sony|zv|e10|usb|capture|uvc/i.test(device.label),
  );
  return {
    deviceId: preferred?.deviceId ?? (!cameraQuery ? videoInputs[0]?.deviceId : null) ?? null,
    labels,
    requiredLabel: cameraQuery ?? "",
  };
}

function withTimeout(promise, ms, onTimeout) {
  let timeoutId = 0;
  const timeout = new Promise((resolve) => {
    timeoutId = window.setTimeout(() => {
      onTimeout();
      resolve(null);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

async function ensureCameraStream() {
  if (cameraStream) return;
  if (cameraOpenAttempt) {
    await cameraOpenAttempt;
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus("Chrome không thấy camera input.");
    return;
  }

  cameraOpenAttempt = (async () => {
    setCameraStatus("Đang mở camera Sony...");
    let cameraDevice = await findVideoDevice();
    const needsPermissionProbe = cameraDevice.labels.length === 0 || cameraDevice.labels.every((label) => label === "(camera without permission)");
    if (needsPermissionProbe || (!cameraDevice.deviceId && cameraDevice.requiredLabel)) {
      const initial = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        }),
        8000,
        () => {
          setCameraStatus("Không nhận được tín hiệu camera. Chọn Cam Link 4K và cho phép camera trong Chrome.");
        },
      );
      if (!(initial instanceof MediaStream)) return;
      initial.getTracks().forEach((track) => track.stop());
      cameraDevice = await findVideoDevice();
    }

    if (!cameraDevice.deviceId) {
      const seenLabels = cameraDevice.labels.length > 0 ? cameraDevice.labels.join(", ") : "không có camera nào";
      const required = cameraDevice.requiredLabel || "Cam Link/Sony";
      setCameraStatus(`Chrome chưa thấy "${required}". Đang thấy: ${seenLabels}`);
      return;
    }

    const initial = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: cameraDevice.deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      }),
      8000,
      () => {
        setCameraStatus("Không nhận được tín hiệu camera. Chọn Cam Link 4K và cho phép camera trong Chrome.");
      },
    );
    if (!(initial instanceof MediaStream)) return;
    cameraStream = initial;
    framePreviewLiveEl.srcObject = cameraStream;
    await framePreviewLiveEl.play();
    setCameraStatus("");
  })();

  try {
    await cameraOpenAttempt;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setCameraStatus(message || "Chrome không mở được camera.");
  } finally {
    if (!cameraStream) cameraOpenAttempt = null;
  }
}

async function clearFramePreview() {
  if (busy || framePreviewEl.hidden) return;
  await fadeToIdle();
}

async function drainQueue() {
  if (busy) return;
  busy = true;

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) continue;

    try {
      await showPhoto(next.url);
      await sleep(displayDurationMs);
      if (queue.length > 0) {
        await fadeOutPhoto();
      }
    } catch (error) {
      console.error(error);
    }
  }

  await fadeToIdle();
  busy = false;
}

/** @param {PhotoReadyEvent} event */
function enqueue(event) {
  const key = `${event.url}|${event.createdAt ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  queue.push(event);
  void drainQueue();
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    /** @type {DisplayConfig} */
    const data = await res.json();
    displayDurationMs = data.displayDurationMs ?? displayDurationMs;
    fadeMs = data.fadeMs ?? fadeMs;
    document.documentElement.style.setProperty("--fade-ms", `${fadeMs}ms`);
  } catch (error) {
    console.warn("Could not load display config", error);
  }
}

async function pollPhotos() {
  try {
    const res = await fetch(`/api/events/poll?since=${encodeURIComponent(since)}`);
    if (!res.ok) return;
    const data = await res.json();
    for (const event of data.framePreviews ?? []) {
      if (event?.type === "frame_preview_clear") await clearFramePreview();
      else if (event?.frameUrl) await showFramePreview(event.frameUrl);
      if (event?.createdAt && event.createdAt > since) since = event.createdAt;
    }
    for (const event of data.photos ?? []) {
      if (event?.url) enqueue(event);
      if (event?.createdAt && event.createdAt > since) since = event.createdAt;
    }
    if (data.serverTime) {
      // keep cursor slightly behind to avoid missing boundary items
    }
  } catch (error) {
    console.warn("Display poll failed", error);
  }
}

function enterFullscreenOnGesture() {
  const request = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      void el.requestFullscreen().catch(() => undefined);
    }
  };
  window.addEventListener("dblclick", request);
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "f") request();
  });
}

function startIdleSlideshow() {
  const VINCOM_SLIDES = [
    "MT1.jpg",
    "MT2.jpg",
    "MT3.jpg",
    "MT4.jpg",
    "S1.jpg",
    "S2.jpg",
    "S3.jpg",
    "S4.jpg",
    "S5.jpg",
    "S5-2B.jpg",
    "S6b.jpg",
    "S7.jpg",
    "S8.jpg",
    "S9.jpg",
    "S10.jpg",
    "PV1.jpg",
    "PV2.jpg",
  ];

  const slidesRoot = document.getElementById("idle-slides");
  if (!(slidesRoot instanceof HTMLElement)) return;

  for (const [i, name] of VINCOM_SLIDES.entries()) {
    const img = document.createElement("img");
    img.className = `idle__slide${i === 0 ? " is-active" : ""}`;
    img.src = `/vincom/${name}`;
    img.alt = "";
    slidesRoot.append(img);
  }

  const slides = [...slidesRoot.querySelectorAll(".idle__slide")];
  if (slides.length < 2) return;
  let index = 0;

  setInterval(() => {
    if (!idleEl.classList.contains("is-visible")) return;
    slides[index]?.classList.remove("is-active");
    index = (index + 1) % slides.length;
    slides[index]?.classList.add("is-active");
  }, 5000);
}

configureLedCanvas();
await loadConfig();
void ensureCameraStream();
enterFullscreenOnGesture();
startIdleSlideshow();
await pollPhotos();
setInterval(() => {
  void pollPhotos();
}, 2000);
