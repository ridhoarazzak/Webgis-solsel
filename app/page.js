import dynamic from "next/dynamic";

const WebGIS = dynamic(() => import("../components/WebGIS"), {
  ssr: false,
  loading: () => <div style={{ padding: 24, fontFamily: "system-ui" }}>Memuat peta…</div>,
});

export default function Page() {
  return <WebGIS />;
}
