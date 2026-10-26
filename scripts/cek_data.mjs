// Cek berkas di public/data: ada/tidak, jumlah fitur, kolom yang dibutuhkan, ukuran.
// Jalankan: node scripts/cek_data.mjs
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "public", "data");
const wajib = {
  "batas_kabupaten.geojson": [],
  "batas_kecamatan.geojson": ["nama", "pdrb_miliar"],
  "batas_nagari.geojson": ["nama", "kecamatan", "panen_ha", "produksi_ton"],
  "tutupan_lahan.geojson": ["kelas"],
  "sawah.geojson": ["luas_ha"],
  "bangunan.geojson": [],
  "jalan.geojson": [],
  "fasilitas.geojson": ["name", "type"],
  "tambang.geojson": ["nama", "komoditas"],
  "potensi_usaha.geojson": ["nama", "sektor"],
};

for (const [file, cols] of Object.entries(wajib)) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) {
    console.log(`-  ${file.padEnd(28)} belum ada`);
    continue;
  }
  const mb = fs.statSync(p).size / 1048576;
  try {
    const gj = JSON.parse(fs.readFileSync(p, "utf8"));
    const feats = gj.features || [];
    const props = new Set(Object.keys((feats[0] && feats[0].properties) || {}));
    const hilang = cols.filter((c) => !props.has(c));
    const warn = mb > 8 ? "  ⚠ besar, sederhanakan di mapshaper.org" : "";
    console.log(
      `OK ${file.padEnd(28)} ${String(feats.length).padStart(6)} fitur  ${mb.toFixed(2)} MB` +
        (hilang.length ? `  ⚠ kolom hilang: ${hilang.join(", ")}` : "") +
        warn
    );
  } catch (e) {
    console.log(`!! ${file.padEnd(28)} bukan GeoJSON valid`);
  }
}
