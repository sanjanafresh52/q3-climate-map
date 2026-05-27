# Q3 2026 NOAA Climate Outlook Map

A single-page web visualization of NOAA Climate Prediction Center's three-month
temperature and precipitation outlook for July–September 2026, overlaid with
14 key U.S. produce-origin markers and freight-specific interpretation
callouts.

This is **not** a recreation of NOAA's outlook page. The value here is the
translation layer: produce regions called out, brand-styled rendering, and
freight context tied to the Q3 lane analysis.

## Running locally

No build step. Serve the directory over HTTP (D3 needs to fetch the state
TopoJSON from a CDN):

```powershell
# Python 3
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

## File layout

| File | What it is |
| --- | --- |
| `index.html` | Page skeleton — title, toggle, SVG container, callout, attribution |
| `styles.css` | Brand colors, layout, callout, legend, responsive rules |
| `data.js` | State-level outlook classifications, marker coordinates, region callout copy |
| `app.js` | D3 renderer: Albers USA projection, base map, overlay, markers, hover/tap, toggle, legend |

## Swapping in real NOAA data

The current overlay is a **synthesized state-level classification** matching
the narrative in the brief (PNW dry, southern tier wet, broad warm signal).
This is a placeholder so the prototype renders without an external download.

To wire up the live CPC feed:

1. Pull the mid-June JAS (Jul–Aug–Sep) shapefile from the [CPC GIS portal](https://ftp.cpc.ncep.noaa.gov/GIS/us_tempprcpfcst/).
2. Convert to GeoJSON (e.g. `ogr2ogr -f GeoJSON out.geojson in.shp`).
3. Replace the `TEMPERATURE_OUTLOOK` / `PRECIPITATION_OUTLOOK` tables in
   `data.js` with a function that maps each NOAA polygon's `Prob` /
   `Cat` attributes to the same classification keys (`above-strong`,
   `above-moderate`, `above-slight`, `near`, `below-slight`,
   `below-moderate`, `below-strong`).
4. In `app.js`, switch the overlay layer from state geometries to the
   NOAA polygon GeoJSON. `overlayColor()` and `COLOR_RAMP` stay the same.

NOAA's shapefile schema is consistent month-to-month, so step 3 only needs
to be written once.

## Brand notes

- Fonts: Montserrat for headers, Open Sans for body and callouts
- Above-normal ramp: `#a8d490` → `#1d3711`
- Below-normal ramp: `#ffd4a8` → `#ec7700`
- Near-normal: light gray
- Region markers: `#ec7700` with white outline
- 8px container border radius, transparent body background

## Attribution

Source: NOAA Climate Prediction Center. Map and freight interpretation by
the analytics team.
