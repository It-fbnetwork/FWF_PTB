/** @typedef {{ displayDurationMs: number, fadeMs: number }} DisplayConfig */
/** @typedef {{ type: "PHOTO_READY", filename: string, url: string, createdAt: string }} PhotoReadyEvent */

const idleEl = document.getElementById("idle");
const photoEl = document.getElementById("photo");
const imageEl = document.getElementById("photo-image");
const framePreviewEl = document.getElementById("frame-preview");
const framePreviewImageEl = document.getElementById("frame-preview-image");

if (
  !(idleEl instanceof HTMLElement) ||
  !(photoEl instanceof HTMLElement) ||
  !(imageEl instanceof HTMLImageElement) ||
  !(framePreviewEl instanceof HTMLElement) ||
  !(framePreviewImageEl instanceof HTMLImageElement)
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
  framePreviewImageEl.src = frameUrl;
  framePreviewEl.hidden = false;
  photoEl.classList.remove("is-visible");
  idleEl.classList.remove("is-visible");
  void framePreviewEl.offsetWidth;
  framePreviewEl.classList.add("is-visible");
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
  const slides = [...document.querySelectorAll(".idle__slide")];
  if (slides.length < 2) return;
  let index = slides.findIndex((el) => el.classList.contains("is-active"));
  if (index < 0) index = 0;

  setInterval(() => {
    if (!idleEl.classList.contains("is-visible")) return;
    slides[index]?.classList.remove("is-active");
    index = (index + 1) % slides.length;
    slides[index]?.classList.add("is-active");
  }, 5000);
}

await loadConfig();
enterFullscreenOnGesture();
startIdleSlideshow();
await pollPhotos();
setInterval(() => {
  void pollPhotos();
}, 2000);
