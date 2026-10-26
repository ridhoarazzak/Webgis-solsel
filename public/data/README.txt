Taruh berkas GeoJSON hasil ekspor GEE di folder ini dengan nama persis:

batas_kabupaten.geojson   garis/poligon batas kabupaten
batas_kecamatan.geojson   kolom: nama, luas_ha, penduduk, pdrb_miliar, tahun
batas_nagari.geojson      kolom: nama, kecamatan, luas_ha, panen_ha, produksi_ton
tutupan_lahan.geojson     kolom: kelas (Air, Pohon, Rumput, Vegetasi_Tergenang,
                          Tanaman_Pertanian, Semak, Terbangun, Lahan_Terbuka), luas_ha
sawah.geojson             kolom: nagari, luas_ha, panen_ha, produksi_ton, puncak_panen
bangunan.geojson          kolom: type, name
jalan.geojson             kolom: name, highway
fasilitas.geojson         titik; kolom: name, type
tambang.geojson           kolom: nama, komoditas (Emas/Batubara/Batu & Pasir/Lainnya), status, luas_ha
potensi_usaha.geojson     titik; kolom: nama, sektor, deskripsi

Layer yang berkasnya belum ada tetap tampil di panel dengan keterangan
"data belum diunggah" dan tidak membuat peta error.
Cek kelengkapan: node scripts/cek_data.mjs
