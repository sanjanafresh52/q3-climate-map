// NOAA Q3 2026 Climate Outlook map
// Renders NOAA CPC probability contour polygons directly (smooth zones that
// cross state boundaries), with state outlines drawn on top as a reference
// grid and produce-region markers above that.

const US_ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const TEMP_URL = "data/outlook-temp.geojson";
const PRECIP_URL = "data/outlook-precip.geojson";

const VIEW_BOX = { width: 960, height: 600 };

const svg = d3.select("#map")
  .attr("viewBox", `0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const projection = d3.geoAlbersUsa().scale(1200).translate([VIEW_BOX.width / 2, VIEW_BOX.height / 2]);
const path = d3.geoPath(projection);

const defs = svg.append("defs");

const layers = {
  base: svg.append("g").attr("class", "layer-base"),
  overlay: svg.append("g").attr("class", "layer-overlay"),
  outline: svg.append("g").attr("class", "layer-outline"),
  markers: svg.append("g").attr("class", "layer-markers")
};

let currentView = "temperature";
let pinnedRegion = null;
let hoveredRegion = null;
const outlook = { temperature: null, precipitation: null };

const calloutTitleEl = document.getElementById("callout-title");
const calloutBodyEl = document.getElementById("callout-body");
const resetBtn = document.getElementById("reset-callout");
const legendEl = document.getElementById("legend");

renderCallout();

Promise.all([
  d3.json(US_ATLAS_URL),
  d3.json(TEMP_URL),
  d3.json(PRECIP_URL)
]).then(([us, tempGeo, precipGeo]) => {
  outlook.temperature = tempGeo;
  outlook.precipitation = precipGeo;

  const states = topojson.feature(us, us.objects.states);
  const stateMesh = topojson.mesh(us, us.objects.states, (a, b) => a !== b);

  projection.fitSize([VIEW_BOX.width, VIEW_BOX.height], states);

  // Clip path: union of state geometries = US landmass. Overlay polygons
  // are clipped to this so contours don't bleed into ocean / off-map areas.
  defs.append("clipPath")
    .attr("id", "us-clip")
      .selectAll("path")
      .data(states.features)
      .join("path")
        .attr("d", path);

  layers.overlay.attr("clip-path", "url(#us-clip)");

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
  console.error("Failed to load map data:", err);
  svg.append("text")
    .attr("x", VIEW_BOX.width / 2)
    .attr("y", VIEW_BOX.height / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#888")
    .style("font-family", "Open Sans, sans-serif")
    .text("Map data failed to load. Check your network and refresh.");
});

// Bin (Cat, Prob) to the discrete legend colors so the map matches the legend.
function colorFor(feature) {
  const cat = feature.properties.Cat;
  const prob = Number(feature.properties.Prob);
  if (!cat || cat === "EC") return COLOR_RAMP["near"];
  if (cat === "Above") {
    if (prob >= 60) return COLOR_RAMP["above-strong"];
    if (prob >= 50) return COLOR_RAMP["above-moderate"];
    return COLOR_RAMP["above-slight"];
  }
  if (cat === "Below") {
    if (prob >= 60) return COLOR_RAMP["below-strong"];
    if (prob >= 50) return COLOR_RAMP["below-moderate"];
    return COLOR_RAMP["below-slight"];
  }
  return COLOR_RAMP["near"];
}

function drawOverlay() {
  const geo = outlook[currentView];
  if (!geo) return;
  layers.overlay.selectAll("path.overlay-poly")
    .data(geo.features, (_, i) => i)
    .join("path")
      .attr("class", "overlay-poly")
      .attr("d", path)
      .attr("fill", d => colorFor(d));
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
  const items = currentView === "precipitation" ? LEGEND_PRECIP : LEGEND_TEMP;
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "legend-row";
    const sw = document.createElement("span");
    sw.className = "legend-swatch";
    sw.style.background = COLOR_RAMP[item.cls];
    const lbl = document.createElement("span");
    lbl.className = "legend-label";
    lbl.textContent = item.label;
    row.appendChild(sw);
    row.appendChild(lbl);
    legendEl.appendChild(row);
  }
}

// Toggle wiring
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

// Tap-elsewhere / Reset clears pinned region (mobile tap-to-reveal)
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
