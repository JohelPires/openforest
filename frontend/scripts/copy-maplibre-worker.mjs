import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(frontendRoot, "node_modules/maplibre-gl/dist");
const publicDir = join(frontendRoot, "public");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(publicDir, { recursive: true });
for (const file of files) {
  copyFileSync(join(dist, file), join(publicDir, file));
}
console.log(`MapLibre worker copiado para public/: ${files.join(", ")}`);
