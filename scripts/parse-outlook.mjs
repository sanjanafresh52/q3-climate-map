#!/usr/bin/env node
// NOAA CPC seasonal outlook shapefile -> GeoJSON parser.
//
// One script, every monthly refresh: NOAA's schema is consistent month to month
// (Fcst_Date, Valid_Seas, Prob, Cat are stable, only values change), so the
// parser written today is the parser used for every future release.
//
// Usage:
//   node scripts/parse-outlook.mjs <temp_zip> <prcp_zip> [--lead=2]
//   node scripts/parse-outlook.mjs data/raw/seastemp_202605.zip data/raw/seasprcp_202605.zip
//
// Writes:
//   data/outlook-temp.geojson
//   data/outlook-precip.geojson
//   data/outlook-meta.json   (issue date, valid season, probability range)
//
// --lead selects which seasonal lead to extract (default 2 = JAS for a May
// release; the same arg picks JAS from a June release as lead 1, etc.).
// If you always want JAS specifically, pass --season=JAS instead.

import { promises as fs, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import mapshaper from "mapshaper";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const TMP_DIR = path.join(DATA_DIR, "_tmp");

function parseArgs(argv) {
  const positional = [];
  const opts = { lead: null, season: null };
  for (const arg of argv) {
    if (arg.startsWith("--lead=")) opts.lead = Number(arg.slice(7));
    else if (arg.startsWith("--season=")) opts.season = arg.slice(9).toUpperCase();
    else positional.push(arg);
  }
  return { positional, opts };
}

async function extractZip(zipPath, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outDir, true);
}

function findShapefile(dir, kind, opts) {
  // dir contains files like lead{N}_{SEASON}_{kind}.shp
  // Pick by --season if given, otherwise by --lead, otherwise default lead 2.
  const files = readdirSync(dir);
  const candidates = files.filter(f => f.endsWith(`_${kind}.shp`) && /^lead\d+_/.test(f));
  if (candidates.length === 0) throw new Error(`No lead*_${kind}.shp in ${dir}`);

  let pick;
  if (opts.season) {
    pick = candidates.find(f => f.toUpperCase().includes(`_${opts.season}_`));
    if (!pick) throw new Error(`No shapefile for season ${opts.season} in ${dir}`);
  } else {
    const wanted = opts.lead ?? 2;
    pick = candidates.find(f => f.startsWith(`lead${wanted}_`));
    if (!pick) throw new Error(`No shapefile for lead ${wanted} in ${dir}`);
  }
  return path.join(dir, pick);
}

function parseFcstDate(raw) {
  // NOAA dbf stores Fcst_Date as a date field. After mapshaper conversion it
  // may arrive as ISO ('2026-05-21T00:00:00.000Z'), MM/DD/YYYY, or YYYYMMDD.
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}

function summarize(features) {
  const probs = features
    .map(f => Number(f.properties.Prob))
    .filter(p => Number.isFinite(p));
  return {
    count: features.length,
    probMin: probs.length ? Math.min(...probs) : null,
    probMax: probs.length ? Math.max(...probs) : null
  };
}

async function shapefileToGeoJSON(shpPath) {
  const baseNoExt = shpPath.replace(/\.shp$/i, "");
  const sidecars = [".shp", ".shx", ".dbf", ".prj", ".cpg"];
  const inputs = {};
  for (const ext of sidecars) {
    const p = baseNoExt + ext;
    try {
      inputs[path.basename(p)] = await fs.readFile(p);
    } catch { /* sidecar may be missing */ }
  }

  // Simplify aggressively for web delivery — visual fidelity at country zoom
  // is unchanged but payload drops ~10x.
  const cmd = [
    "-i", path.basename(shpPath),
    "-clean",
    "-simplify", "8%", "keep-shapes",
    "-o", "format=geojson", "precision=0.001", "out.geojson"
  ].join(" ");
  const out = await mapshaper.applyCommands(cmd, inputs);
  return JSON.parse(out["out.geojson"].toString("utf8"));
}

async function main() {
  const { positional, opts } = parseArgs(process.argv.slice(2));
  if (positional.length < 2) {
    console.error("Usage: node scripts/parse-outlook.mjs <temp_zip> <prcp_zip> [--lead=N | --season=JAS]");
    process.exit(1);
  }
  const [tempZip, prcpZip] = positional;

  await fs.rm(TMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TMP_DIR, { recursive: true });

  const tempDir = path.join(TMP_DIR, "temp");
  const prcpDir = path.join(TMP_DIR, "prcp");

  console.log("Extracting", tempZip);
  await extractZip(tempZip, tempDir);
  console.log("Extracting", prcpZip);
  await extractZip(prcpZip, prcpDir);

  const tempShp = findShapefile(tempDir, "temp", opts);
  const prcpShp = findShapefile(prcpDir, "prcp", opts);
  console.log("Temp shapefile:", path.basename(tempShp));
  console.log("Prcp shapefile:", path.basename(prcpShp));

  const tempGeo = await shapefileToGeoJSON(tempShp);
  const prcpGeo = await shapefileToGeoJSON(prcpShp);

  const tempStats = summarize(tempGeo.features);
  const prcpStats = summarize(prcpGeo.features);

  const sample = tempGeo.features[0]?.properties ?? prcpGeo.features[0]?.properties ?? {};
  const issueDate = parseFcstDate(sample.Fcst_Date);
  const validSeason = String(sample.Valid_Seas || "").trim();

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, "outlook-temp.geojson"), JSON.stringify(tempGeo));
  await fs.writeFile(path.join(DATA_DIR, "outlook-precip.geojson"), JSON.stringify(prcpGeo));

  const meta = {
    issueDate,
    validSeason,
    sourceFiles: {
      temp: path.basename(tempShp),
      prcp: path.basename(prcpShp)
    },
    parsedAt: new Date().toISOString(),
    stats: { temp: tempStats, prcp: prcpStats }
  };
  await fs.writeFile(path.join(DATA_DIR, "outlook-meta.json"), JSON.stringify(meta, null, 2));

  console.log("");
  console.log("Issue date:    ", issueDate);
  console.log("Valid season:  ", validSeason);
  console.log("Temp polygons: ", tempStats.count, "Prob range:", tempStats.probMin, "→", tempStats.probMax);
  console.log("Prcp polygons: ", prcpStats.count, "Prob range:", prcpStats.probMin, "→", prcpStats.probMax);
  console.log("");
  console.log("Wrote:");
  console.log("  data/outlook-temp.geojson");
  console.log("  data/outlook-precip.geojson");
  console.log("  data/outlook-meta.json");

  await fs.rm(TMP_DIR, { recursive: true, force: true });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
