const form = document.getElementById("checkin-form");
const errorEl = document.getElementById("error");
const submitBtn = document.getElementById("submit");

if (!(form instanceof HTMLFormElement) || !(errorEl instanceof HTMLElement) || !(submitBtn instanceof HTMLButtonElement)) {
  throw new Error("Check-in DOM incomplete");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;

  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") ?? ""),
    phone: String(data.get("phone") ?? ""),
    consent: data.get("consent") === "on",
  };

  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Check-in failed");
    window.location.href = `/checkin/${json.session.code}`;
  } catch (error) {
    errorEl.textContent = error instanceof Error ? error.message : String(error);
    errorEl.hidden = false;
    submitBtn.disabled = false;
  }
});
