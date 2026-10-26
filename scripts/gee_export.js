/**
 * SKRIP EKSPOR GEE -> WEBGIS SOLOK SELATAN
 * Jalankan di https://code.earthengine.google.com
 *
 * Hasilnya masuk ke Google Drive (folder "webgis_solsel") sebagai GeoJSON.
 * Unduh berkas, ganti nama sesuai daftar di bawah, lalu taruh di public/data/.
 *
 * Ganti nilai di bagian PENGATURAN dengan asset Anda.
 */

// ======================== PENGATURAN ========================
// Asset batas (FeatureCollection). Kolom wajib: nama.
// Nagari juga sebaiknya punya kolom: kecamatan
var ASSET_KABUPATEN = 'projects/GANTI/assets/batas_solsel';
var ASSET_KECAMATAN = 'projects/GANTI/assets/batas_kecamatan_solsel';
var ASSET_NAGARI    = 'projects/GANTI/assets/batas_nagari_solsel';

// Asset opsional (isi jika ada, kosongkan '' jika tidak)
var ASSET_SAWAH   = '';   // poligon sawah hasil klasifikasi
var ASSET_TAMBANG = '';   // poligon tambang (kolom: nama, komoditas, status)
var ASSET_BANGUNAN = '';  // bangunan OSM / hasil deteksi
var ASSET_JALAN   = '';
var ASSET_FASILITAS = '';
var ASSET_POTENSI = '';   // titik potensi usaha (kolom: nama, sektor, deskripsi)

var FOLDER = 'webgis_solsel';
var TAHUN_AWAL = '2024-01-01';
var TAHUN_AKHIR = '2025-01-01';
var SIMPLIFY_M = 30;      // sederhanakan geometri (meter) agar berkas ringan
// ============================================================

var kab = ee.FeatureCollection(ASSET_KABUPATEN);
var kec = ee.FeatureCollection(ASSET_KECAMATAN);
var nag = ee.FeatureCollection(ASSET_NAGARI);
var aoi = kab.geometry();

Map.centerObject(aoi, 9);
Map.addLayer(kab, {color: 'black'}, 'Kabupaten', true);

function exportFC(fc, nama, kolom) {
  if (kolom) fc = fc.select(kolom);
  Export.table.toDrive({
    collection: fc,
    description: nama,
    folder: FOLDER,
    fileNamePrefix: nama,
    fileFormat: 'GeoJSON'
  });
}

function simplify(fc) {
  return fc.map(function (f) { return f.simplify(SIMPLIFY_M); });
}

// ---------------- 1. BATAS ADMINISTRASI
exportFC(simplify(kab), 'batas_kabupaten');
exportFC(simplify(kec), 'batas_kecamatan');
exportFC(simplify(nag), 'batas_nagari');

// ---------------- 2. TUTUPAN LAHAN (Dynamic World, modus per piksel)
var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
  .filterDate(TAHUN_AWAL, TAHUN_AKHIR)
  .filterBounds(aoi)
  .select('label')
  .mode()
  .clip(aoi);

var namaKelas = ['Air', 'Pohon', 'Rumput', 'Vegetasi_Tergenang', 'Tanaman_Pertanian',
                 'Semak', 'Terbangun', 'Lahan_Terbuka', 'Salju_Es'];
var warna = ['#419bdf', '#397d49', '#88b053', '#7a87c6', '#e49635',
             '#dfc35a', '#c4281b', '#a59b8f', '#b39fe1'];
Map.addLayer(dw, {min: 0, max: 8, palette: warna}, 'Dynamic World');

// 2a. Luas per kelas per nagari (tabel statistik, ringan, untuk popup/grafik)
var luasKelas = nag.map(function (f) {
  var areaImg = ee.Image.pixelArea().divide(10000).addBands(dw);
  var grp = areaImg.reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'kelas'}),
    geometry: f.geometry(), scale: 10, maxPixels: 1e10, tileScale: 4
  });
  return f.set('luas_per_kelas', grp.get('groups'));
});
Export.table.toDrive({
  collection: luasKelas, description: 'statistik_tutupan_lahan_nagari',
  folder: FOLDER, fileFormat: 'GeoJSON'
});

// 2b. Poligon tutupan lahan (disederhanakan). Untuk area luas, jalankan per kecamatan.
var vektor = dw.reduceToVectors({
  geometry: aoi, scale: 30, geometryType: 'polygon', eightConnected: false,
  labelProperty: 'kode', reducer: ee.Reducer.countEvery(), maxPixels: 1e10, bestEffort: true
}).map(function (f) {
  var kode = ee.Number(f.get('kode'));
  return f.set('kelas', ee.List(namaKelas).get(kode))
          .set('luas_ha', f.geometry().area(10).divide(10000));
}).select(['kelas', 'luas_ha']);
exportFC(vektor, 'tutupan_lahan');

// 2c. ALTERNATIF RASTER: ekspor GeoTIFF lalu buat tile XYZ dengan gdal2tiles
Export.image.toDrive({
  image: dw.visualize({min: 0, max: 8, palette: warna}).clip(aoi),
  description: 'tutupan_lahan_rgb', folder: FOLDER, region: aoi, scale: 30,
  maxPixels: 1e10
});

// ---------------- 3. PERTANIAN / PADI
if (ASSET_SAWAH) {
  var sawah = ee.FeatureCollection(ASSET_SAWAH);
  // Pastikan kolom: nagari, luas_ha, panen_ha, produksi_ton, puncak_panen
  exportFC(simplify(sawah), 'sawah');
}

// Ringkasan produksi per nagari: tambahkan kolom panen_ha, produksi_ton,
// puncak_panen ke asset nagari Anda, atau gabungkan di sini:
// var nagGabung = nag.map(function (f) { ... .set('produksi_ton', ...) });

// ---------------- 4. BANGUNAN, JALAN, FASILITAS
if (ASSET_BANGUNAN)  exportFC(simplify(ee.FeatureCollection(ASSET_BANGUNAN)), 'bangunan');
if (ASSET_JALAN)     exportFC(ee.FeatureCollection(ASSET_JALAN), 'jalan');
if (ASSET_FASILITAS) exportFC(ee.FeatureCollection(ASSET_FASILITAS), 'fasilitas');

// Kepadatan bangunan/penduduk (GHSL) per nagari
var pop = ee.ImageCollection('JRC/GHSL/P2023A/GHS_POP').filter(ee.Filter.eq('system:index', '2020')).first();
var nagPenduduk = nag.map(function (f) {
  var p = pop.reduceRegion({reducer: ee.Reducer.sum(), geometry: f.geometry(), scale: 100, maxPixels: 1e10});
  return f.set('penduduk_ghsl', ee.Number(p.values().get(0)).round());
});
Export.table.toDrive({
  collection: nagPenduduk, description: 'batas_nagari_penduduk',
  folder: FOLDER, fileFormat: 'GeoJSON'
});

// ---------------- 5. TAMBANG, POTENSI USAHA, PDRB
if (ASSET_TAMBANG) exportFC(simplify(ee.FeatureCollection(ASSET_TAMBANG)), 'tambang');
if (ASSET_POTENSI) exportFC(ee.FeatureCollection(ASSET_POTENSI), 'potensi_usaha');

// PDRB bukan dari satelit: gabungkan data BPS ke batas_kecamatan.geojson
// sebagai kolom pdrb_miliar dan tahun (lihat README bagian "Data PDRB").

// ---------------- 6. UJI CEPAT: URL tile GEE (kadaluarsa, hanya untuk uji)
dw.visualize({min: 0, max: 8, palette: warna}).getMap({}, function (m) {
  print('URL tile sementara (tempel ke layer type "xyz"):', m.urlFormat);
});

print('Selesai. Buka tab Tasks, klik RUN pada setiap ekspor.');
