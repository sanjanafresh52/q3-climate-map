// NOAA seasonal climate outlook map for the Q3 produce freight briefing.
// Renders real CPC probability polygons (parsed from the shapefile by
// scripts/parse-outlook.mjs) with Albers USA projection, produce-region
// markers, and hover/tap freight callouts.

const US_ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const TEMP_URL = "data/outlook-temp.geojson";
const PRECIP_URL = "data/outlook-precip.geojson";
const META_URL = "data/outlook-meta.json";

const VIEW_BOX = { width: 960, height: 600 };

// Brand color ramps from the brief
const RAMP_ABOVE = ["#a8d490", "#1d3711"]; // light → deep green
const RAMP_BELOW = ["#ffd4a8", "#ec7700"]; // light → deep orange
const COLOR_EC = "#e5e5e5";                // equal chances / near-normal

const svg = d3.select("#map")
  .attr("viewBox", `0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const projection = d3.geoAlbersUsa().scale(1280).translate([VIEW_BOX.width / 2, VIEW_BOX.height / 2]);
const path = d3.geoPath(projection);

const layers = {
  base: svg.append("g").attr("class", "layer-base"),
  overlay: svg.append("g").attr("class", "layer-overlay"),
  outline: svg.append("g").attr("class", "layer-outline"),
  markers: svg.append("g").attr("class", "layer-markers")
};

let currentView = "temperature";
let pinnedRegion = null;
let hoveredRegion = null;
let meta = null;
let outlook = { temperature: null, precipitation: null };

const calloutTitleEl = document.getElementById("callout-title");
const calloutBodyEl = document.getElementById("callout-body");
const resetBtn = document.getElementById("reset-callout");
const legendEl = document.getElementById("legend");
const titleEl = document.getElementById("map-title");
const subtitleEl = document.getElementById("map-subtitle");

renderCallout();

Promise.all([
  d3.json(US_ATLAS_URL),
  d3.json(TEMP_URL),
  d3.json(PRECIP_URL),
  d3.json(META_URL)
]).then(([us, tempGeo, precipGeo, m]) => {
  meta = m;
  outlook.temperature = tempGeo;
  outlook.precipitation = precipGeo;

  // Per-brief: log the probability field's range to verify continuous binding
  console.log(
    "[outlook] issue=%s valid=%s | temp prob %d→%d | precip prob %d→%d",
    meta.issueDate, meta.validSeason,
    meta.stats.temp.probMin, meta.stats.temp.probMax,
    meta.stats.prcp.probMin, meta.stats.prcp.probMax
  );

  applyTitle();

  const states = topojson.feature(us, us.objects.states);
  const stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

  layers.base.selectAll("path.base-state")
    .data(states.features)
    .join("path")
      .attr("class", "base-state")
      .attr("d", path);

  drawOverlay();

  layers.outline.append("path")
    .attr("class", "state-outline")
    .attr("d", path(stateMesh));

  drawMarkers();
  drawLegend();
}).catch(err => {
  console.error("Failed to load data:", err);
  svg.append("text")
    .attr("x", VIEW_BOX.width / 2)
    .attr("y", VIEW_BOX.height / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#888")
    .style("font-family", "Open Sans, sans-serif")
    .text("Outlook data failed to load. Run `npm run parse` and refresh.");
});

function applyTitle() {
  const season = meta.validSeason || "Seasonal Outlook";
  titleEl.textContent = `NOAA Climate Outlook — ${season}`;
  const issued = meta.issueDate
    ? new Date(meta.issueDate + "T00:00:00Z").toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric", timeZone: "UTC"
      })
    : "—";
  subtitleEl.textContent =
    `Three-month temperature & precipitation outlook (issued ${issued}), with produce-region freight context.`;
}

function colorFor(feature, view) {
  const cat = feature.properties.Cat;
  const prob = Number(feature.properties.Prob);
  if (cat === "EC" || !Number.isFinite(prob)) return COLOR_EC;

  const stats = view === "precipitation" ? meta.stats.prcp : meta.stats.temp;
  const baseline = 33;
  const span = Math.max(1, stats.probMax - baseline);
  const t = Math.max(0, Math.min(1, (prob - baseline) / span));

  if (cat === "Above") return d3.interpolateRgb(RAMP_ABOVE[0], RAMP_ABOVE[1])(t);
  if (cat === "Below") return d3.interpolateRgb(RAMP_BELOW[0], RAMP_BELOW[1])(t);
  return COLOR_EC;
}

function drawOverlay() {
  const geo = outlook[currentView];
  layers.overlay.selectAll("path.overlay-poly")
    .data(geo.features, (d, i) => i)
    .join("path")
      .attr("class", "overlay-poly")
      .attr("d", path)
      .attr("fill", d => colorFor(d, currentView));
}

function drawMarkers() {
  const points = MARKERS.map(m => {
    const xy = projection([m.lng, m.lat]);
    return { ...m, x: xy ? xy[0] : null, y: xy ? xy[1] : null };
  }).filter(m => m.x !== null);

  const sel = layers.markers.selectAll("circle.marker")
    .data(points, d => d.id)
    .join("circle")
      .attr("class", "marker")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 5)
      .attr("data-region", d => d.region)
      .on("mouseenter", (event, d) => {
        hoveredRegion = d.region;
        renderCallout();
        highlightRegion(d.region);
      })
      .on("mouseleave", () => {
        hoveredRegion = null;
        renderCallout();
        highlightRegion(pinnedRegion);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        pinnedRegion = d.region;
        hoveredRegion = d.region;
        renderCallout();
        highlightRegion(pinnedRegion);
      });

  sel.append("title").text(d => d.name);
}

function highlightRegion(regionId) {
  layers.markers.selectAll("circle.marker")
    .classed("active", d => d.region === regionId)
    .transition().duration(140)
      .attr("r", d => d.region === regionId ? 7.5 : 5);
}

function renderCallout() {
  const regionId = hoveredRegion || pinnedRegion;
  const data = regionId ? REGION_CALLOUTS[regionId] : DEFAULT_CALLOUT;
  calloutTitleEl.textContent = data.title;
  calloutBodyEl.textContent = data.body;
  resetBtn.hidden = !pinnedRegion;
}

function drawLegend() {
  legendEl.innerHTML = "";
  const stats = currentView === "precipitation" ? meta.stats.prcp : meta.stats.temp;
  const items = [];

  // Build legend stops for each non-EC category present in the data, plus EC.
  const cats = new Set(outlook[currentView].features.map(f => f.properties.Cat));
  const baseline = 33;

  if (cats.has("Above")) {
    items.push({ ramp: RAMP_ABOVE, min: baseline, max: stats.probMax, label: "Above-normal" });
  }
  items.push({ solid: COLOR_EC, label: "Equal chances (33%)" });
  if (cats.has("Below")) {
    items.push({ ramp: RAMP_BELOW, min: baseline, max: stats.probMax, label: "Below-normal" });
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "legend-row";

    const sw = document.createElement("span");
    sw.className = "legend-swatch";
    if (item.solid) {
      sw.style.background = item.solid;
    } else {
      sw.style.background = `linear-gradient(to right, ${item.ramp[0]}, ${item.ramp[1]})`;
    }
    const lbl = document.createElement("span");
    lbl.className = "legend-label";
    lbl.textContent = item.min !== undefined
      ? `${item.label} (${item.min}% → ${item.max}%)`
      : item.label;
    row.appendChild(sw);
    row.appendChild(lbl);
    legendEl.appendChild(row);
  }
}

// Toggle behavior: ~200ms fade between views, markers + callout persist.
document.querySelectorAll(".toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    const view = btn.getAttribute("data-view");
    if (view === currentView) return;
    currentView = view;
    document.querySelectorAll(".toggle").forEach(b => {
      const isActive = b.getAttribute("data-view") === view;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    layers.overlay.selectAll("path.overlay-poly")
      .transition().duration(200)
        .style("opacity", 0)
        .on("end", () => {
          drawOverlay();
          layers.overlay.selectAll("path.overlay-poly")
            .style("opacity", 0)
            .transition().duration(200)
              .style("opacity", 1);
        });

    drawLegend();
  });
});

// Tap elsewhere to unpin
svg.on("click", () => {
  if (pinnedRegion) {
    pinnedRegion = null;
    hoveredRegion = null;
    renderCallout();
    highlightRegion(null);
  }
});

resetBtn.addEventListener("click", () => {
  pinnedRegion = null;
  hoveredRegion = null;
  renderCallout();
  highlightRegion(null);
});
