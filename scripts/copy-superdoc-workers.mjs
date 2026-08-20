// Menyalin worker SuperDoc v2 dari node_modules ke public/superdoc.
//
// Turbopack dev tidak menyajikan worker bawaan node_modules, jadi berkasnya
// harus ada di public/. Sebelumnya berkas ini disalin manual dan ikut
// ter-commit (~14 MB), padahal:
//   - namanya content-hashed, jadi jadi basi tiap @superdoc/docx-engine naik versi;
//   - isinya proprietary (DOCX Engine Pro), tidak layak masuk repo.
// Skrip ini dijalankan lewat `postinstall` sehingga selalu sinkron dengan
// versi paket yang terpasang, dan menulis nama STABIL supaya path di
// SuperDocEditor.tsx tidak perlu ikut berubah saat hash berganti.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "node_modules/@superdoc/docx-engine/dist/assets");
const outDir = path.join(root, "public/superdoc");

// Prefix entri worker -> nama stabil yang dipakai frontend.
const WORKERS = {
  "browser-worker-entry": "browser-worker-entry.js",
  "collaboration-worker-entry": "collaboration-worker-entry.js",
  "review-index-worker-entry": "review-index-worker-entry.js",
};

if (!fs.existsSync(srcDir)) {
  // Bukan error fatal: `npm install` bisa jalan sebelum paket opsional ada,
  // dan gagal di postinstall akan menggagalkan seluruh install.
  console.warn(`[superdoc] ${path.relative(root, srcDir)} tidak ada — worker tidak disalin.`);
  process.exit(0);
}

const available = fs.readdirSync(srcDir).filter((name) => name.endsWith(".js"));
fs.mkdirSync(outDir, { recursive: true });

// Bersihkan salinan lama (termasuk berkas ber-hash dari versi sebelumnya)
// supaya public/superdoc tidak menumpuk sampah tiap upgrade.
for (const name of fs.readdirSync(outDir)) {
  if (name.endsWith(".js")) fs.rmSync(path.join(outDir, name));
}

const missing = [];
for (const [prefix, outName] of Object.entries(WORKERS)) {
  const match = available.find((name) => name.startsWith(`${prefix}-`) || name === `${prefix}.js`);
  if (!match) {
    missing.push(prefix);
    continue;
  }
  fs.copyFileSync(path.join(srcDir, match), path.join(outDir, outName));
  console.log(`[superdoc] ${match} -> public/superdoc/${outName}`);
}

if (missing.length > 0) {
  // Ini nyata-nyata merusak editor, jadi harus berisik — tapi tetap exit 0
  // agar `npm install` tidak gagal total. Cek nama entri di rilis baru.
  console.error(`[superdoc] entri worker tidak ditemukan: ${missing.join(", ")}`);
  console.error(`[superdoc] isi ${path.relative(root, srcDir)}: ${available.join(", ")}`);
}
