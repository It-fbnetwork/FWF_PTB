import sharp from "sharp";
import { config } from "./config.js";

export async function generateDefaultFramePng(
  width = config.outputWidth,
  height = config.outputHeight,
): Promise<Buffer> {
  const barH = Math.round(height * 0.16);
  const barTop = height - barH;
  const pad = Math.round(width * 0.07);
  const corner = Math.round(width * 0.12);
  const stroke = Math.max(4, Math.round(width * 0.008));
  const titleSize = Math.round(width * 0.055);
  const subSize = Math.round(width * 0.028);
  const tagSize = Math.round(width * 0.03);
  const foxSize = Math.round(width * 0.11);
  const foxX = width - pad - foxSize - 8;
  const foxY = height - pad - foxSize - 4;
  const titleY = barTop + Math.round(barH * 0.42);
  const subY = titleY + Math.round(titleSize * 0.85);
  const accentY = subY + Math.round(subSize * 0.55);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bar" x1="0" y1="${barTop}" x2="0" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1A120B" stop-opacity="0"/>
      <stop offset="0.28" stop-color="#1A120B" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#1A120B" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="fox" x1="${foxX}" y1="${foxY}" x2="${foxX + foxSize}" y2="${foxY + foxSize}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F4A261"/>
      <stop offset="1" stop-color="#E85D04"/>
    </linearGradient>
  </defs>

  <path d="M${pad} ${pad} H${pad + corner}" stroke="#E85D04" stroke-width="${stroke}" stroke-linecap="square"/>
  <path d="M${pad} ${pad} V${pad + corner}" stroke="#E85D04" stroke-width="${stroke}" stroke-linecap="square"/>
  <path d="M${width - pad - corner} ${pad} H${width - pad}" stroke="#E85D04" stroke-width="${stroke}" stroke-linecap="square"/>
  <path d="M${width - pad} ${pad} V${pad + corner}" stroke="#E85D04" stroke-width="${stroke}" stroke-linecap="square"/>
  <path d="M${pad} ${height - pad - corner} V${height - pad}" stroke="#F4A261" stroke-width="${stroke}" stroke-linecap="square"/>
  <path d="M${pad} ${height - pad} H${pad + corner}" stroke="#F4A261" stroke-width="${stroke}" stroke-linecap="square"/>

  <rect x="0" y="${barTop}" width="${width}" height="${barH}" fill="url(#bar)"/>
  <rect x="${pad}" y="${accentY}" width="${Math.round(width * 0.08)}" height="${Math.max(4, Math.round(height * 0.005))}" fill="#E85D04"/>

  <text x="${pad}" y="${titleY}" fill="#FFF8F0" font-family="Helvetica Neue, Arial, sans-serif" font-size="${titleSize}" font-weight="700" letter-spacing="3">FACE WASH FOX</text>
  <text x="${pad}" y="${subY}" fill="#F4A261" font-family="Helvetica Neue, Arial, sans-serif" font-size="${subSize}" font-weight="500" letter-spacing="2">PHOTO BOOTH</text>
  <text x="${foxX - 12}" y="${foxY + foxSize * 0.62}" fill="#FFF8F0" font-family="Helvetica Neue, Arial, sans-serif" font-size="${tagSize}" font-weight="500" letter-spacing="1" text-anchor="end">#FaceWashFox</text>

  <g transform="translate(${foxX} ${foxY}) scale(${foxSize / 112})">
    <path d="M16 86 L56 18 L96 86 Z" fill="url(#fox)"/>
    <path d="M32 86 L56 42 L80 86 Z" fill="#1A120B" fill-opacity="0.18"/>
    <circle cx="48" cy="70" r="3.5" fill="#1A120B"/>
    <circle cx="64" cy="70" r="3.5" fill="#1A120B"/>
    <path d="M52 80 Q56 86 60 80" stroke="#1A120B" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M16 86 L8 48 L32 62 Z" fill="#E85D04"/>
    <path d="M96 86 L104 48 L80 62 Z" fill="#E85D04"/>
  </g>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
