"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { MAP_CONFIG, BASEMAPS, GROUPS, LAYERS } from "../lib/layers";

const GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
const FONT = ["Open Sans Regular", "Arial Unicode MS Regular"];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmt = (v) => {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "number") return v.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return String(v);
};

function colorExpr(layer) {
  if (layer.categorical) {
    const { property, colors, fallback } = layer.categorical;
    const pairs = Object.entries(colors).flat();
    return ["match", ["to-string", ["get", property]], ...pairs, fallback || "#cbd5e1"];
  }
  if (layer.choropleth) {
    const { property, breaks, colors } = layer.choropleth;
    const step = ["step", ["to-number", ["get", property], 0], colors[0]];
    breaks.forEach((b, i) => step.push(b, colors[i + 1]));
    return ["case", ["has", property], step, "#e5e7eb"];
  }
  return layer.color || "#2563eb";
}

function bboxOf(geojson) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const walk = (c) => {
    if (typeof c[0] === "number") {
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    } else c.forEach(walk);
  };
  const feats = geojson.type === "FeatureCollection" ? geojson.features : [geojson];
  feats.forEach((f) => f.geometry && walk(f.geometry.coordinates));
  if (minX > maxX) return null;
  return [[minX, minY], [maxX, maxY]];
}

function legendFor(layer) {
  if (layer.categorical) {
    return Object.entries(layer.categorical.colors).map(([k, c]) => ({ color: c, label: k.replace(/_/g, " ") }));
  }
  if (layer.choropleth) {
    const { breaks, colors } = layer.choropleth;
    const f = (n) => n.toLocaleString("id-ID");
    return colors.map((c, i) => ({
      color: c,
      label:
        i === 0 ? `< ${f(breaks[0])}` : i === breaks.length ? `≥ ${f(breaks[i - 1])}` : `${f(breaks[i - 1])} – ${f(breaks[i])}`,
    }));
  }
  if (layer.color) return [{ color: layer.color, label: layer.title }];
  return [];
}

export default function WebGIS() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const dataRef = useRef({}); // id -> geojson
  const addedRef = useRef({}); // id -> [mapLayerIds]
  const fittedRef = useRef(false);

  const [visible, setVisible] = useState(() =>
    Object.fromEntries(LAYERS.map((l) => [l.id, !!l.defaultOn]))
  );
  const [status, setStatus] = useState({});
  const [opacity, setOpacity] = useState(() =>
    Object.fromEntries(LAYERS.map((l) => [l.id, l.opacity ?? 1]))
  );
  const [basemap, setBasemap] = useState(BASEMAPS[0].id);
  const [open, setOpen] = useState(() => Object.fromEntries(GROUPS.map((g, i) => [g.id, i === 0])));
  const [sidebar, setSidebar] = useState(true);
  const [query, setQuery] = useState("");
  const [loadedTick, setLoadedTick] = useState(0);
  const [ready, setReady] = useState(false);

  const setSt = (id, s) => setStatus((p) => ({ ...p, [id]: s }));

  // ------------------------------------------------ init map
  useEffect(() => {
    const bm = BASEMAPS[0];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: GLYPHS,
        sources: {
          base: { type: "raster", tiles: bm.tiles, tileSize: 256, attribution: bm.attribution, maxzoom: 19 },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      maxBounds: MAP_CONFIG.maxBounds || undefined,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    mapRef.current = map;

    map.on("load", () => {
      readyRef.current = true;
      setReady(true);
    });

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "320px" });
    map.on("click", (e) => {
      const ids = Object.entries(addedRef.current)
        .filter(([lid]) => true)
        .flatMap(([lid, arr]) => arr.filter((m) => map.getLayer(m) && map.getLayoutProperty(m, "visibility") !== "none" && !m.endsWith("-label")));
      if (!ids.length) return;
      const feats = map.queryRenderedFeatures(e.point, { layers: ids });
      if (!feats.length) return;
      // utamakan titik > garis > poligon
      const rank = (f) => (f.geometry.type.includes("Point") ? 0 : f.geometry.type.includes("Line") ? 1 : 2);
      feats.sort((a, b) => rank(a) - rank(b));
      const f = feats[0];
      const layer = LAYERS.find((l) => f.layer.id.startsWith(l.id + "::"));
      if (!layer) return;
      const props = f.properties || {};
      const entries = layer.popupFields
        ? Object.entries(layer.popupFields).filter(([k]) => k in props)
        : Object.keys(props).map((k) => [k, k]);
      const rows = entries
        .map(([k, label]) => `<tr><td class="pk">${esc(label)}</td><td class="pv">${esc(fmt(props[k]))}</td></tr>`)
        .join("");
      popup
        .setLngLat(e.lngLat)
        .setHTML(`<div class="pp"><div class="pt">${esc(layer.title)}</div><table>${rows || "<tr><td>Tidak ada atribut</td></tr>"}</table></div>`)
        .addTo(map);
    });
    map.on("mousemove", (e) => {
      const ids = Object.values(addedRef.current)
        .flat()
        .filter((m) => map.getLayer(m) && map.getLayoutProperty(m, "visibility") !== "none" && !m.endsWith("-label"));
      map.getCanvas().style.cursor = ids.length && map.queryRenderedFeatures(e.point, { layers: ids }).length ? "pointer" : "";
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // ------------------------------------------------ add a layer to the map
  const addLayer = useCallback(async (layer) => {
    const map = mapRef.current;
    if (!map || addedRef.current[layer.id]) return true;
    const sid = `src::${layer.id}`;
    const mk = (suffix) => `${layer.id}::${suffix}`;
    const ids = [];

    try {
      if (layer.type === "xyz") {
        // cek ketersediaan tile pada zoom rendah
        const probe = layer.url.replace("{z}", "8").replace("{x}", "0").replace("{y}", "0");
        const sameOrigin = layer.url.startsWith("/");
        if (sameOrigin) {
          const r = await fetch(probe, { method: "HEAD" });
          const ct = r.headers.get("content-type") || "";
          if (!r.ok || !ct.startsWith("image")) {
            // tile spesifik bisa saja tidak ada; cek manifest sederhana
            const m = await fetch(layer.url.replace(/\{z\}.*$/, "tilejson.json"));
            if (!m.ok) throw new Error("missing");
          }
        }
        map.addSource(sid, {
          type: "raster",
          tiles: [layer.url],
          tileSize: 256,
          maxzoom: layer.maxzoom || 18,
          minzoom: layer.minzoom || 0,
        });
        map.addLayer({
          id: mk("raster"),
          type: "raster",
          source: sid,
          paint: { "raster-opacity": layer.opacity ?? 1 },
        });
        ids.push(mk("raster"));
      } else if (layer.type === "image") {
        map.addSource(sid, { type: "image", url: layer.url, coordinates: layer.coordinates });
        map.addLayer({ id: mk("raster"), type: "raster", source: sid, paint: { "raster-opacity": layer.opacity ?? 1 } });
        ids.push(mk("raster"));
      } else {
        const res = await fetch(layer.url);
        if (!res.ok) throw new Error("missing");
        const gj = await res.json();
        if (!gj || !(gj.features || gj.geometry)) throw new Error("invalid");
        dataRef.current[layer.id] = gj;
        map.addSource(sid, { type: "geojson", data: gj, generateId: true });
        const common = layer.minzoom ? { minzoom: layer.minzoom } : {};

        if (layer.geometry === "fill") {
          map.addLayer({
            id: mk("fill"),
            type: "fill",
            source: sid,
            filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
            paint: { "fill-color": colorExpr(layer), "fill-opacity": layer.opacity ?? 0.6 },
            ...common,
          });
          map.addLayer({
            id: mk("line"),
            type: "line",
            source: sid,
            paint: {
              "line-color": layer.outline || "#334155",
              "line-width": layer.categorical ? 0.4 : 1,
              "line-opacity": 0.8,
            },
            ...common,
          });
          ids.push(mk("fill"), mk("line"));
        } else if (layer.geometry === "line") {
          map.addLayer({
            id: mk("line"),
            type: "line",
            source: sid,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": colorExpr(layer), "line-width": layer.width || 1.5, "line-opacity": layer.opacity ?? 1 },
            ...common,
          });
          ids.push(mk("line"));
        } else {
          map.addLayer({
            id: mk("circle"),
            type: "circle",
            source: sid,
            paint: {
              "circle-color": colorExpr(layer),
              "circle-radius": layer.radius || 5,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.2,
              "circle-opacity": layer.opacity ?? 1,
            },
            ...common,
          });
          ids.push(mk("circle"));
        }

        if (layer.labelProperty) {
          map.addLayer({
            id: mk("label"),
            type: "symbol",
            source: sid,
            minzoom: Math.max(layer.minzoom || 0, layer.geometry === "circle" ? 11 : 9),
            layout: {
              "text-field": ["to-string", ["get", layer.labelProperty]],
              "text-font": FONT,
              "text-size": 11,
              "text-offset": layer.geometry === "circle" ? [0, 1.1] : [0, 0],
              "text-anchor": layer.geometry === "circle" ? "top" : "center",
              "text-allow-overlap": false,
            },
            paint: { "text-color": "#0f172a", "text-halo-color": "#ffffffcc", "text-halo-width": 1.4 },
          });
          ids.push(mk("label"));
        }
        setLoadedTick((t) => t + 1);

        if (layer.id === "kabupaten" && !fittedRef.current) {
          const b = bboxOf(gj);
          if (b) {
            fittedRef.current = true;
            map.fitBounds(b, { padding: 40, duration: 800 });
          }
        }
      }
      addedRef.current[layer.id] = ids;
      setSt(layer.id, "ok");
      return true;
    } catch (err) {
      if (map.getSource(sid) && !ids.length) map.removeSource(sid);
      setSt(layer.id, err.message === "missing" ? "missing" : "error");
      return false;
    }
  }, []);

  // ------------------------------------------------ sync visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    LAYERS.forEach(async (layer) => {
      const on = visible[layer.id];
      if (on && !addedRef.current[layer.id]) {
        setSt(layer.id, "loading");
        const ok = await addLayer(layer);
        if (!ok) setVisible((p) => ({ ...p, [layer.id]: false }));
        else reorder();
      }
      (addedRef.current[layer.id] || []).forEach((m) => {
        if (map.getLayer(m)) map.setLayoutProperty(m, "visibility", on ? "visible" : "none");
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready, addLayer]);

  // urutan: poligon di bawah, garis, lalu titik, lalu label
  function reorder() {
    const map = mapRef.current;
    if (!map) return;
    const all = Object.values(addedRef.current).flat().filter((m) => map.getLayer(m));
    const weight = (m) => (m.endsWith("::label") ? 4 : m.endsWith("::circle") ? 3 : m.endsWith("::line") ? 2 : 1);
    all.sort((a, b) => weight(a) - weight(b)).forEach((m) => map.moveLayer(m));
  }

  // ------------------------------------------------ opacity
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    LAYERS.forEach((layer) => {
      const op = opacity[layer.id];
      (addedRef.current[layer.id] || []).forEach((m) => {
        if (!map.getLayer(m)) return;
        if (m.endsWith("::fill")) map.setPaintProperty(m, "fill-opacity", op);
        else if (m.endsWith("::raster")) map.setPaintProperty(m, "raster-opacity", op);
        else if (m.endsWith("::circle")) {
          map.setPaintProperty(m, "circle-opacity", op);
        } else if (m.endsWith("::line") && layer.geometry === "line") map.setPaintProperty(m, "line-opacity", op);
      });
    });
  }, [opacity, ready, loadedTick]);

  // ------------------------------------------------ basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const bm = BASEMAPS.find((b) => b.id === basemap);
    const src = map.getSource("base");
    if (src && src.setTiles) src.setTiles(bm.tiles);
  }, [basemap, ready]);

  // ------------------------------------------------ search
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    LAYERS.forEach((l) => {
      const gj = dataRef.current[l.id];
      if (!l.labelProperty || !gj || !gj.features) return;
      gj.features.forEach((f) => {
        const name = f.properties && f.properties[l.labelProperty];
        if (name && String(name).toLowerCase().includes(q) && out.length < 12) {
          out.push({ layer: l, name: String(name), feature: f });
        }
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, loadedTick]);

  const flyTo = (r) => {
    const map = mapRef.current;
    const b = bboxOf(r.feature);
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 15, duration: 900 });
    setQuery("");
  };

  // ------------------------------------------------ legend
  const legendLayers = LAYERS.filter((l) => visible[l.id] && status[l.id] === "ok" && legendFor(l).length);

  const toggle = (id) => setVisible((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="app">
      <header className="top">
        <button className="burger" onClick={() => setSidebar((s) => !s)} aria-label="Panel layer">
          ☰
        </button>
        <div className="brand">
          <b>{MAP_CONFIG.title}</b>
          <span>{MAP_CONFIG.subtitle}</span>
        </div>
      </header>

      <aside className={`side ${sidebar ? "" : "hidden"}`}>
        <div className="search">
          <input
            placeholder="Cari nagari, kecamatan, fasilitas…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <ul className="results">
              {results.map((r, i) => (
                <li key={i} onClick={() => flyTo(r)}>
                  <b>{r.name}</b>
                  <small>{r.layer.title}</small>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section className="block">
          <h4>Peta Dasar</h4>
          <div className="chips">
            {BASEMAPS.map((b) => (
              <button key={b.id} className={basemap === b.id ? "on" : ""} onClick={() => setBasemap(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
        </section>

        {GROUPS.map((g) => (
          <section className="block" key={g.id}>
            <h4 className="gh" onClick={() => setOpen((p) => ({ ...p, [g.id]: !p[g.id] }))}>
              <span>{g.label}</span>
              <i>{open[g.id] ? "−" : "+"}</i>
            </h4>
            {open[g.id] &&
              LAYERS.filter((l) => l.group === g.id).map((l) => (
                <div className="layer" key={l.id}>
                  <label>
                    <input type="checkbox" checked={!!visible[l.id]} onChange={() => toggle(l.id)} />
                    <span className="sw" style={{ background: l.color || Object.values(l.categorical?.colors || l.choropleth?.colors || ["#94a3b8"]).slice(-1)[0] }} />
                    <span className="lt">{l.title}</span>
                    {status[l.id] === "loading" && <em className="st">memuat…</em>}
                    {status[l.id] === "missing" && <em className="st warn">data belum diunggah</em>}
                    {status[l.id] === "error" && <em className="st warn">berkas tidak valid</em>}
                  </label>
                  {visible[l.id] && status[l.id] === "ok" && (
                    <input
                      className="range"
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={opacity[l.id]}
                      onChange={(e) => setOpacity((p) => ({ ...p, [l.id]: parseFloat(e.target.value) }))}
                      aria-label={`Transparansi ${l.title}`}
                    />
                  )}
                </div>
              ))}
          </section>
        ))}

        <footer className="foot">
          Sumber: analisis Google Earth Engine, OpenStreetMap, GHSL, Dynamic World. Data bersifat indikatif.
        </footer>
      </aside>

      <div ref={containerRef} className="map" />

      {legendLayers.length > 0 && (
        <div className="legend">
          {legendLayers.map((l) => (
            <div key={l.id} className="lg">
              <b>{l.title}</b>
              {legendFor(l).map((it, i) => (
                <div className="li" key={i}>
                  <span className="sw" style={{ background: it.color }} />
                  {it.label}
                </div>
              ))}
              {l.choropleth?.unit && <small>Satuan: {l.choropleth.unit}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
