// Build helper: copies the barcode scanner's WebAssembly file into public/ so
// it is served from our own origin (no CDN: privacy, offline, and a strict CSP
// later). Runs automatically as npm predev/prebuild.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync(
  "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm",
  "public/vendor/zxing_reader.wasm",
);
