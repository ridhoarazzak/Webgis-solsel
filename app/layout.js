import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata = {
  title: "WebGIS Solok Selatan",
  description: "Atlas spasial terpadu Kabupaten Solok Selatan: batas administrasi, tutupan lahan, pertanian, infrastruktur, tambang, potensi usaha dan PDRB.",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
