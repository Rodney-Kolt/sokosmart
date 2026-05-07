/**
 * generate-icons.mjs
 * Generates icon-192.png and icon-512.png for the PWA manifest.
 * Run once: node generate-icons.mjs
 * Requires: npm install sharp (temporary, not added to package.json)
 */

import { createCanvas } from "canvas";
import { writeFileSync } from "fs";

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, size, size);

  // Green circle
  const grad = ctx.createRadialGradient(size * 0.4, size * 0.35, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#25D366");
  grad.addColorStop(1, "#075E54");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // Shopping bag emoji
  ctx.font = `${size * 0.45}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🛍️", size / 2, size / 2 + size * 0.03);

  writeFileSync(outputPath, canvas.toBuffer("image/png"));
  console.log(`✅ Generated ${outputPath}`);
}

generateIcon(192, "public/icon-192.png");
generateIcon(512, "public/icon-512.png");
