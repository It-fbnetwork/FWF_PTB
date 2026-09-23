/** @typedef {{ displayDurationMs: number, fadeMs: number }} DisplayConfig */
/** @typedef {{ type: "PHOTO_READY", filename: string, url: string, createdAt: string }} PhotoReadyEvent */

const idleEl = document.getElementById("idle");
const photoEl = document.getElementById("photo");
const imageEl = document.getElementById("photo-image");

if (!(idleEl instanceof HTMLElement) || !(photoEl instanceof HTMLElement) || !(imageEl instanceof HTMLImageElement)) {
  throw new Error("Display DOM is incomplete");
}

/** @type {PhotoReadyEvent[]} */
const queue = [];
let busy = false;
let displayDurationMs = 8000;
let fadeMs = 700;

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
  await sleep(fadeMs);
  photoEl.hidden = true;
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
  idleEl.classList.remove("is-visible");
  void photoEl.offsetWidth;
  photoEl.classList.add("is-visible");
  await sleep(fadeMs);
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

function connectEvents() {
  const source = new EventSource("/api/events");

  source.addEventListener("connected", () => {
    console.info("[FWF display] connected");
  });

  source.addEventListener("photo_ready", (message) => {
    try {
      /** @type {PhotoReadyEvent} */
      const event = JSON.parse(message.data);
      if (event?.url) {
        console.info("[FWF display] photo ready", event.filename);
        enqueue(event);
      }
    } catch (error) {
      console.error("Bad photo_ready payload", error);
    }
  });

  source.onerror = () => {
    console.warn("Display event stream disconnected; retrying…");
  };
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

await loadConfig();
connectEvents();
enterFullscreenOnGesture();
