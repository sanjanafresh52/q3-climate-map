# Q3 NOAA Climate Outlook Map

A single-page web visualization of NOAA Climate Prediction Center's three-month
temperature and precipitation outlook, overlaid with 14 key U.S.
produce-origin markers and freight-specific interpretation callouts.

This is **not** a recreation of NOAA's outlook page. The value here is the
translation layer: produce regions called out, brand-styled rendering, and
freight context tied to the Q3 lane analysis.

**Live:** https://sanjanafresh52.github.io/q3-climate-map/

## Currently rendering

Mid-May (third-Thursday) 2026 issuance of the seasonal outlook, JAS
(Jul–Aug–Sep) lead. The mid-**June** JAS release — the canonical Q3
deliverable in the brief — is published on the third Thursday of June and
will replace this dataset once available. The map's title, subtitle, and
issue date all read from `data/outlook-meta.json`, so they auto-update when
the parser is re-run.

## Architecture

```
NOAA shapefile (.zip)  ─▶  scripts/parse-outlook.mjs  ─▶  data/outlook-*.geojson
                                  (mapshaper)                +  outlook-meta.json
                                                                       │
                                                                       ▼
                                                              index.html  +  app.js
                                                              (D3, AlbersUSA)
```

| File | Role |
| --- | --- |
| `scripts/parse-outlook.mjs` | Schema-stable shapefile → GeoJSON parser. Same script handles every monthly release. |
| `data/outlook-temp.geojson` | NOAA temperature probability polygons (Cat: Above/Below/EC, Prob: %). |
| `data/outlook-precip.geojson` | NOAA precipitation probability polygons. |
| `data/outlook-meta.json` | Issue date, valid season, probability ranges. Drives the title. |
| `index.html` + `styles.css` | Page shell, toggle, callout panel, brand styling. |
| `data.js` | 14 produce-origin markers + 7 USDA-region freight callouts. |
| `app.js` | D3 renderer: Albers USA projection, polygon overlay with continuous probability shading, hover/tap. |

## Running locally

```powershell
# Install Node deps (mapshaper, adm-zip)
npm install

# Serve the static page
npm run serve
# then open http://localhost:3000
```

## Monthly refresh workflow

NOAA CPC issues a new seasonal outlook **on the third Thursday of every
month**. To refresh the map after the release:

1. **Download** the two latest zips from
   <https://ftp.cpc.ncep.noaa.gov/GIS/us_tempprcpfcst/> into `data/raw/`:

   ```powershell
   $month = "202606"   # YYYYMM of the new issuance
   curl -o data/raw/seastemp_$month.zip "https://ftp.cpc.ncep.noaa.gov/GIS/us_tempprcpfcst/seastemp_$month.zip"
   curl -o data/raw/seasprcp_$month.zip "https://ftp.cpc.ncep.noaa.gov/GIS/us_tempprcpfcst/seasprcp_$month.zip"
   ```

2. **Parse** — same command every month, only the input filename and
   `--season` flag change:

   ```powershell
   node scripts/parse-outlook.mjs data/raw/seastemp_202606.zip data/raw/seasprcp_202606.zip --season=JAS
   ```

   Use `--season=JAS` for the Jul–Aug–Sep lead, or `--lead=N` to pick the
   Nth seasonal lead from that issuance (1, 2, 3 … = next, second, third
   season out).

3. **Commit & push** the regenerated `data/outlook-*.geojson` and
   `data/outlook-meta.json`. The map title and issue date update automatically
   on next page load — no code changes required.

NOAA's shapefile schema is consistent month-to-month
(`Fcst_Date`, `Valid_Seas`, `Prob`, `Cat`), so the parser written today is the
parser used for every future refresh.

## Color encoding

Both **category** and **probability** are bound to fill:

| Category | Ramp | What probability does |
| --- | --- | --- |
| `Above` | `#a8d490` → `#1d3711` (light → deep green) | Darker = stronger above-normal signal |
| `Below` | `#ffd4a8` → `#ec7700` (light → deep orange) | Darker = stronger below-normal signal |
| `EC` | `#e5e5e5` (light gray) | Equal chances baseline |

The interpolation runs from the 33% baseline to the **actual max probability
in the data** (continuous scale per view), so multiple shades show within each
category. Open the browser console — the loaded probability range for both
views is logged on page init.

## Mid-June JAS swap

Once NOAA releases the June 18, 2026 issuance:

```powershell
curl -o data/raw/seastemp_202606.zip "https://ftp.cpc.ncep.noaa.gov/GIS/us_tempprcpfcst/seastemp_202606.zip"
curl -o data/raw/seasprcp_202606.zip "https://ftp.cpc.ncep.noaa.gov/GIS/us_tempprcpfcst/seasprcp_202606.zip"
node scripts/parse-outlook.mjs data/raw/seastemp_202606.zip data/raw/seasprcp_202606.zip --season=JAS
git add data/outlook-*.json data/outlook-*.geojson
git commit -m "Refresh outlook to mid-June 2026 JAS issuance"
git push
```

That's the whole workflow.

## Attribution

Source: NOAA Climate Prediction Center. Map and freight interpretation by
the analytics team.
