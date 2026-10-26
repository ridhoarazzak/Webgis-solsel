# WebGIS Solok Selatan

Atlas spasial terpadu Kabupaten Solok Selatan: batas administrasi, tutupan lahan,
pertanian/panen padi, bangunan-jalan-fasilitas, tambang, potensi usaha, dan PDRB.
Dibangun dengan **Next.js + MapLibre GL**, data dari **Google Earth Engine**, deploy di **Vercel**.

## Struktur

```
app/                 halaman Next.js
components/WebGIS.jsx  peta, panel layer, legenda, pencarian, popup
lib/layers.js        SEMUA konfigurasi layer (edit di sini)
public/data/         GeoJSON hasil analisis (isi sendiri)
scripts/gee_export.js  skrip GEE untuk ekspor data
scripts/cek_data.mjs   pengecek kelengkapan data
```

## Alur kerja

### 1. Ekspor data dari GEE
1. Buka `scripts/gee_export.js`, tempel di https://code.earthengine.google.com
2. Ganti `projects/GANTI/assets/...` dengan asset Anda.
3. Jalankan, lalu klik **RUN** di tab *Tasks* untuk tiap ekspor.
4. Unduh dari Google Drive (folder `webgis_solsel`) dan taruh di `public/data/`
   dengan nama sesuai `public/data/README.txt`.

Tips ukuran: berkas lebih dari ±8 MB sebaiknya disederhanakan di
https://mapshaper.org (Simplify 10–20%) atau dibagi per kecamatan.
Untuk raster (tutupan lahan penuh), ekspor GeoTIFF lalu buat tile:
`gdal2tiles.py -z 7-14 --xyz lc.tif public/tiles/lc`.

### 2. Data non-satelit
- **PDRB**: gabungkan angka BPS per kecamatan ke `batas_kecamatan.geojson`
  (kolom `pdrb_miliar`, `tahun`). Bisa lewat QGIS (join by `nama`) atau mapshaper.
- **Tambang & potensi usaha**: titik/poligon dari data ESDM/Dinas, atau gambar sendiri di QGIS/geojson.io.
- **Produksi padi**: tambahkan `panen_ha` dan `produksi_ton` ke `batas_nagari.geojson`.

### 3. Cek lokal
```bash
npm install
node scripts/cek_data.mjs
npm run dev      # buka http://localhost:3000
```

### 4. GitHub
```bash
git init
git add .
git commit -m "WebGIS Solok Selatan"
git branch -M main
git remote add origin https://github.com/USERNAME/webgis-solsel.git
git push -u origin main
```
(Buat dulu repository kosong `webgis-solsel` di github.com.)
Batas ukuran berkas GitHub 100 MB; data yang lebih besar pakai tile atau Git LFS.

### 5. Deploy Vercel
1. Masuk https://vercel.com dengan akun GitHub → **Add New → Project**.
2. Pilih repository `webgis-solsel` → framework terdeteksi **Next.js** → **Deploy**.
3. Setiap `git push` ke `main` otomatis memperbarui situs.
Domain sendiri: Project → Settings → Domains.

## Menambah layer baru
Tambahkan satu objek di `LAYERS` pada `lib/layers.js` (lihat komentar di berkas itu).
Pewarnaan mendukung satu warna, kategori (`categorical`), dan bertingkat (`choropleth`).

## Catatan
- Hasil dari data satelit bersifat **indikatif**, bukan data resmi.
- Tile GEE langsung (`getMap`) kedaluwarsa dan butuh autentikasi, jadi tidak cocok untuk situs
  publik. Gunakan ekspor GeoJSON/GeoTIFF seperti di atas.
- Peta dasar memakai OSM, CARTO, dan Esri; patuhi ketentuan atribusinya.
