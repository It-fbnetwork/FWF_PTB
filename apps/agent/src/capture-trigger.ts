import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { log } from "./logger.js";

const execFileAsync = promisify(execFile);

const ptpWindowCaptureScript = `
$process = Get-Process -Name 'CameraControlPTP' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $process) { throw 'CameraControlPTP is not running' }
$event = [Threading.EventWaitHandle]::OpenExisting('Local\\FWF_PTP_CAPTURE')
try {
  [void]$event.Set()
} finally {
  $event.Dispose()
}
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function triggerCapture(countdownMs: number): Promise<void> {
  log.info(`Remote capture requested. Shooting in ${Math.round(countdownMs / 1000)} seconds...`);
  await sleep(countdownMs);

  if (process.platform !== "win32") {
    throw new Error("Automatic Imaging Edge trigger is currently supported on Windows only");
  }

  // Sony Imaging Edge Remote's official keyboard shortcut for Photo is "1".
  const key = process.env.FWF_CAPTURE_KEY ?? "1";
  const escapedKey = key.replace(/'/g, "''");
  const mode = process.env.FWF_CAPTURE_MODE ?? "ptp-window";

  if (mode === "ptp-window") {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", ptpWindowCaptureScript],
      { windowsHide: true },
    );
    log.success("Sony PTP S2 capture command sent in the background.");
    return;
  }

  const script = [
    "$shell = New-Object -ComObject WScript.Shell",
    ...(mode === "alt-tab"
      ? [
          "$shell.SendKeys('%{TAB}')",
          "Start-Sleep -Milliseconds 650",
        ]
      : []),
    `$shell.SendKeys('${escapedKey}')`,
    ...(mode === "alt-tab"
      ? [
          "Start-Sleep -Milliseconds 650",
          "$shell.SendKeys('%{TAB}')",
        ]
      : []),
  ].join("; ");

  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    windowsHide: true,
  });
  log.success(
    mode === "alt-tab"
      ? "Switched to IEDT, sent capture key, and returned to display."
      : "Capture key sent to the active Windows application.",
  );
}
