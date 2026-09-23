const code = window.location.pathname.split("/").filter(Boolean).pop()?.toUpperCase() ?? "";
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");
const phoneEl = document.getElementById("phone");
const leadEl = document.getElementById("lead");
const titleEl = document.getElementById("title");
const nextStepEl = document.getElementById("next-step");
const photoEl = document.getElementById("photo");
const photoPlaceholderEl = document.getElementById("photo-placeholder");
const actionsEl = document.getElementById("actions");
const downloadEl = document.getElementById("download");

if (
  !(statusEl instanceof HTMLElement) ||
  !(nameEl instanceof HTMLElement) ||
  !(phoneEl instanceof HTMLElement) ||
  !(leadEl instanceof HTMLElement) ||
  !(titleEl instanceof HTMLElement) ||
  !(nextStepEl instanceof HTMLElement) ||
  !(photoEl instanceof HTMLImageElement) ||
  !(photoPlaceholderEl instanceof HTMLElement) ||
  !(actionsEl instanceof HTMLElement) ||
  !(downloadEl instanceof HTMLAnchorElement)
) {
  throw new Error("Session DOM incomplete");
}

function statusClass(status) {
  if (status === "READY" || status === "SELECTED") return "is-ready";
  if (status === "READY_TO_DISPLAY" || status === "COMPLETED" || status === "DISPLAYING") return "is-done";
  return "";
}

function render(session) {
  statusEl.textContent = session.status;
  statusEl.className = `status-pill ${statusClass(session.status)}`;
  nameEl.textContent = session.name;
  phoneEl.textContent = session.phone;

  const selected =
    session.photos.find((p) => p.id === session.selectedPhotoId) ??
    session.photos[session.photos.length - 1];

  if (session.status === "WAITING") {
    titleEl.textContent = "CHECK-IN THÀNH CÔNG";
    leadEl.textContent = "Bước tiếp theo: đến khu vực chụp ảnh.";
    nextStepEl.hidden = false;
    nextStepEl.innerHTML = `
      <p class="notice__eyebrow">BƯỚC TIẾP THEO</p>
      <p class="notice__title">Đến khu vực chụp ảnh</p>
      <ol class="notice__steps">
        <li>Giữ màn hình này.</li>
        <li>Đến booth Face Wash Fox.</li>
        <li>Nhân viên sẽ gọi tên bạn để chụp.</li>
      </ol>
    `;
  } else if (session.status === "READY" || session.status === "SELECTED") {
    titleEl.textContent = "CHECK-IN THÀNH CÔNG";
    leadEl.textContent = "Bạn đã sẵn sàng — đến khu vực chụp ảnh nhé.";
    nextStepEl.hidden = false;
    nextStepEl.innerHTML = `
      <p class="notice__eyebrow">BƯỚC TIẾP THEO</p>
      <p class="notice__title">Đến khu vực chụp ảnh</p>
      <ol class="notice__steps">
        <li>Giữ màn hình này.</li>
        <li>Đứng vào khung chụp khi được gọi.</li>
        <li>Sau khi chụp, ảnh sẽ hiện ngay bên dưới.</li>
      </ol>
    `;
  } else if (session.status === "PROCESSING" || session.status === "CAPTURED") {
    titleEl.textContent = "ĐANG XỬ LÝ";
    leadEl.textContent = "Ảnh của bạn đang được ghép frame Face Wash Fox…";
    nextStepEl.hidden = true;
  } else {
    titleEl.textContent = "YOUR FWF MOMENT";
    leadEl.textContent = "Ảnh Face Wash Fox của bạn đã sẵn sàng.";
    nextStepEl.hidden = true;
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
      nextStepEl.hidden = true;
    }
  } else {
    photoPlaceholderEl.hidden = false;
    photoEl.hidden = true;
    photoEl.removeAttribute("src");
    actionsEl.hidden = true;
  }
}

async function refresh() {
  const res = await fetch(`/api/sessions/code/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Không tìm thấy phiên check-in");
  const json = await res.json();
  render(json.session);
}

await refresh();

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
