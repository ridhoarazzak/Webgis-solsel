// =====================================================================
// KONFIGURASI WEBGIS SOLOK SELATAN
// Untuk menambah layer: taruh file di public/data/ lalu tambahkan
// satu objek di LAYERS di bawah. Tidak perlu mengubah kode lain.
// =====================================================================

export const MAP_CONFIG = {
  title: "WebGIS Solok Selatan",
  subtitle: "Atlas spasial terpadu Kabupaten Solok Selatan",
  center: [101.2, -1.5], // [lon, lat] perkiraan pusat kabupaten
  zoom: 9.3,
  // Isi jika ingin membatasi peta ke area Solok Selatan: [[barat, selatan],[timur, utara]]
  maxBounds: null,
};

export const BASEMAPS = [
  {
    id: "terang",
    label: "Terang",
    tiles: ["https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap, © CARTO",
  },
  {
    id: "osm",
    label: "Jalan (OSM)",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "satelit",
    label: "Satelit",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
  },
];

export const GROUPS = [
  { id: "batas", label: "Batas Administrasi" },
  { id: "lahan", label: "Tutupan Lahan" },
  { id: "pertanian", label: "Pertanian & Panen Padi" },
  { id: "infra", label: "Bangunan, Jalan & Fasilitas" },
  { id: "ekonomi", label: "Tambang, Potensi Usaha & PDRB" },
];

/*
 Jenis layer (type):
   "geojson"  -> file GeoJSON di public/data (geometry: fill | line | circle)
   "xyz"      -> tile raster {z}/{x}/{y} (mis. hasil gdal2tiles atau tile GEE)
   "image"    -> gambar raster tunggal (PNG) dengan koordinat sudut

 Pewarnaan (untuk geojson):
   color            -> satu warna
   categorical      -> { property, colors: { nilai: "#hex" }, fallback }
   choropleth       -> { property, breaks: [b1,b2,...], colors: [c0,c1,...] }
                       (jumlah colors = jumlah breaks + 1), unit: "teks legenda"
 Opsional: labelProperty (nama untuk label/pencarian), popupFields (daftar kolom
 yang ditampilkan di popup, beserta alias), defaultOn, opacity, minzoom.
*/
export const LAYERS = [
  // ---------------------------- BATAS ADMINISTRASI
  {
    id: "kabupaten",
    group: "batas",
    title: "Batas Kabupaten",
    type: "geojson",
    url: "/data/batas_kabupaten.geojson",
    geometry: "line",
    color: "#0f172a",
    width: 2.5,
    defaultOn: true,
  },
  {
    id: "kecamatan",
    group: "batas",
    title: "Kecamatan",
    type: "geojson",
    url: "/data/batas_kecamatan.geojson",
    geometry: "fill",
    color: "#2563eb",
    opacity: 0.12,
    outline: "#1d4ed8",
    labelProperty: "nama",
    defaultOn: true,
    popupFields: { nama: "Kecamatan", luas_ha: "Luas (ha)", penduduk: "Penduduk" },
  },
  {
    id: "nagari",
    group: "batas",
    title: "Nagari",
    type: "geojson",
    url: "/data/batas_nagari.geojson",
    geometry: "fill",
    color: "#0ea5e9",
    opacity: 0.08,
    outline: "#0369a1",
    labelProperty: "nama",
    minzoom: 9,
    popupFields: { nama: "Nagari", kecamatan: "Kecamatan", luas_ha: "Luas (ha)" },
  },

  // ---------------------------- TUTUPAN LAHAN
  {
    id: "tutupan_lahan",
    group: "lahan",
    title: "Tutupan Lahan (Dynamic World)",
    type: "geojson",
    url: "/data/tutupan_lahan.geojson",
    geometry: "fill",
    opacity: 0.75,
    categorical: {
      property: "kelas",
      colors: {
        Air: "#419bdf",
        Pohon: "#397d49",
        Rumput: "#88b053",
        Vegetasi_Tergenang: "#7a87c6",
        Tanaman_Pertanian: "#e49635",
        Semak: "#dfc35a",
        Terbangun: "#c4281b",
        Lahan_Terbuka: "#a59b8f",
      },
      fallback: "#cbd5e1",
    },
    popupFields: { kelas: "Kelas", luas_ha: "Luas (ha)" },
  },
  {
    id: "tutupan_lahan_raster",
    group: "lahan",
    title: "Tutupan Lahan (raster tile)",
    type: "xyz",
    // Isi dengan tile hasil gdal2tiles (/tiles/lc/{z}/{x}/{y}.png) atau URL tile GEE
    url: "/tiles/lc/{z}/{x}/{y}.png",
    opacity: 0.8,
    maxzoom: 14,
  },

  // ---------------------------- PERTANIAN
  {
    id: "sawah",
    group: "pertanian",
    title: "Lahan Sawah / Padi",
    type: "geojson",
    url: "/data/sawah.geojson",
    geometry: "fill",
    color: "#84cc16",
    opacity: 0.7,
    popupFields: {
      nagari: "Nagari",
      luas_ha: "Luas (ha)",
      panen_ha: "Luas panen (ha)",
      produksi_ton: "Produksi GKG (ton)",
      puncak_panen: "Puncak panen",
    },
  },
  {
    id: "produksi_padi",
    group: "pertanian",
    title: "Produksi Padi per Nagari (ton GKG)",
    type: "geojson",
    url: "/data/batas_nagari.geojson",
    geometry: "fill",
    opacity: 0.8,
    choropleth: {
      property: "produksi_ton",
      breaks: [500, 1500, 3000, 6000],
      colors: ["#f7fcb9", "#c2e699", "#78c679", "#31a354", "#006837"],
      unit: "ton GKG",
    },
    popupFields: { nama: "Nagari", panen_ha: "Luas panen (ha)", produksi_ton: "Produksi (ton)" },
  },

  // ---------------------------- BANGUNAN, JALAN, FASILITAS
  {
    id: "bangunan",
    group: "infra",
    title: "Bangunan",
    type: "geojson",
    url: "/data/bangunan.geojson",
    geometry: "fill",
    color: "#f97316",
    opacity: 0.85,
    minzoom: 13,
    popupFields: { type: "Jenis", name: "Nama" },
  },
  {
    id: "jalan",
    group: "infra",
    title: "Jaringan Jalan",
    type: "geojson",
    url: "/data/jalan.geojson",
    geometry: "line",
    color: "#7c3aed",
    width: 1.6,
    popupFields: { name: "Nama", highway: "Kelas jalan" },
  },
  {
    id: "fasilitas",
    group: "infra",
    title: "Fasilitas Umum",
    type: "geojson",
    url: "/data/fasilitas.geojson",
    geometry: "circle",
    color: "#e11d48",
    radius: 5,
    labelProperty: "name",
    popupFields: { name: "Nama", type: "Jenis" },
  },

  // ---------------------------- EKONOMI
  {
    id: "tambang",
    group: "ekonomi",
    title: "Pertambangan",
    type: "geojson",
    url: "/data/tambang.geojson",
    geometry: "fill",
    opacity: 0.7,
    categorical: {
      property: "komoditas",
      colors: {
        Emas: "#eab308",
        Batubara: "#1f2937",
        "Batu & Pasir": "#a8a29e",
        Lainnya: "#78716c",
      },
      fallback: "#78716c",
    },
    popupFields: { nama: "Nama", komoditas: "Komoditas", status: "Status", luas_ha: "Luas (ha)" },
  },
  {
    id: "potensi_usaha",
    group: "ekonomi",
    title: "Potensi Usaha",
    type: "geojson",
    url: "/data/potensi_usaha.geojson",
    geometry: "circle",
    radius: 6,
    categorical: {
      property: "sektor",
      colors: {
        Pertanian: "#65a30d",
        Perkebunan: "#16a34a",
        Pariwisata: "#0891b2",
        Energi: "#f59e0b",
        Peternakan: "#b45309",
        Perikanan: "#2563eb",
        UMKM: "#db2777",
      },
      fallback: "#64748b",
    },
    labelProperty: "nama",
    popupFields: { nama: "Nama", sektor: "Sektor", deskripsi: "Keterangan" },
  },
  {
    id: "pdrb",
    group: "ekonomi",
    title: "PDRB per Kecamatan (miliar Rp)",
    type: "geojson",
    url: "/data/batas_kecamatan.geojson",
    geometry: "fill",
    opacity: 0.8,
    choropleth: {
      property: "pdrb_miliar",
      breaks: [200, 400, 700, 1000],
      colors: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
      unit: "miliar Rp",
    },
    popupFields: { nama: "Kecamatan", pdrb_miliar: "PDRB (miliar Rp)", tahun: "Tahun" },
  },
];
