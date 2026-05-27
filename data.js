// Synthesized state-level probability classifications for the
// NOAA CPC JAS (Jul-Aug-Sep) 2026 outlook narrative described in the brief.
// Replace with parsed CPC shapefile GeoJSON when wiring up the live data feed.
//
// Classification keys map to the brand color ramp:
//   above-strong   #3a6b22   (60%+ probability above-normal)
//   above-moderate #7cb854   (50-60%)
//   above-slight   #a8d490   (40-50%)
//   near           #e5e5e5   (equal chances)
//   below-slight   #ffd4a8   (40-50% below)
//   below-moderate #f4a564   (50-60% below)
//   below-strong   #ec7700   (60%+ below)

const TEMPERATURE_OUTLOOK = {
  "Arizona":        "above-strong",
  "New Mexico":     "above-strong",
  "Nevada":         "above-strong",
  "Utah":           "above-strong",
  "Colorado":       "above-strong",
  "California":     "above-moderate",
  "Oregon":         "above-moderate",
  "Washington":     "above-moderate",
  "Idaho":          "above-moderate",
  "Wyoming":        "above-moderate",
  "Montana":        "above-slight",
  "Texas":          "above-moderate",
  "Oklahoma":       "above-slight",
  "Kansas":         "above-slight",
  "Nebraska":       "above-slight",
  "South Dakota":   "above-slight",
  "North Dakota":   "near",
  "Minnesota":      "near",
  "Wisconsin":      "near",
  "Iowa":           "above-slight",
  "Missouri":       "above-slight",
  "Arkansas":       "above-slight",
  "Louisiana":      "above-slight",
  "Mississippi":    "above-slight",
  "Alabama":        "above-slight",
  "Florida":        "above-slight",
  "Georgia":        "above-slight",
  "South Carolina": "above-slight",
  "North Carolina": "above-slight",
  "Tennessee":      "above-slight",
  "Kentucky":       "above-slight",
  "Virginia":       "above-slight",
  "West Virginia":  "above-slight",
  "Ohio":           "above-slight",
  "Indiana":        "above-slight",
  "Illinois":       "above-slight",
  "Michigan":       "near",
  "Pennsylvania":   "above-slight",
  "New York":       "above-slight",
  "New Jersey":     "above-slight",
  "Connecticut":    "above-slight",
  "Rhode Island":   "above-slight",
  "Massachusetts":  "near",
  "Vermont":        "near",
  "New Hampshire":  "near",
  "Maine":          "near",
  "Maryland":       "above-slight",
  "Delaware":       "above-slight",
  "District of Columbia": "above-slight"
};

const PRECIPITATION_OUTLOOK = {
  // South-tier wet signal
  "Texas":          "above-slight",
  "Louisiana":      "above-moderate",
  "Mississippi":    "above-moderate",
  "Alabama":        "above-moderate",
  "Florida":        "above-slight",
  "Georgia":        "above-slight",
  "South Carolina": "above-slight",
  "Arkansas":       "above-slight",
  // PNW dry signal
  "Washington":     "below-moderate",
  "Oregon":         "below-moderate",
  "Idaho":          "below-slight",
  "Montana":        "below-slight"
  // Everything else defaults to "near"
};

const COLOR_RAMP = {
  "above-strong":   "#3a6b22",
  "above-moderate": "#7cb854",
  "above-slight":   "#a8d490",
  "near":           "#e5e5e5",
  "below-slight":   "#ffd4a8",
  "below-moderate": "#f4a564",
  "below-strong":   "#ec7700"
};

const LEGEND_TEMP = [
  { cls: "above-strong",   label: "Above-normal 60%+" },
  { cls: "above-moderate", label: "Above-normal 50-60%" },
  { cls: "above-slight",   label: "Above-normal 40-50%" },
  { cls: "near",           label: "Equal chances" }
];

const LEGEND_PRECIP = [
  { cls: "above-moderate", label: "Above-normal 50-60%" },
  { cls: "above-slight",   label: "Above-normal 40-50%" },
  { cls: "near",           label: "Equal chances" },
  { cls: "below-slight",   label: "Below-normal 40-50%" },
  { cls: "below-moderate", label: "Below-normal 50-60%" }
];

// 14 produce-origin markers, grouped into 7 USDA regions.
const MARKERS = [
  { id: 1,  name: "Yakima / Wenatchee, WA",     lat: 46.6021, lng: -120.5059, region: "pnw" },
  { id: 2,  name: "Hood River, OR",             lat: 45.7054, lng: -121.5215, region: "pnw" },
  { id: 3,  name: "Salinas, CA",                lat: 36.6777, lng: -121.6555, region: "california" },
  { id: 4,  name: "San Joaquin Valley, CA",     lat: 36.7378, lng: -119.7871, region: "california" },
  { id: 5,  name: "Watsonville, CA",            lat: 36.9102, lng: -121.7569, region: "california" },
  { id: 6,  name: "Treasure Valley, ID",        lat: 43.6629, lng: -116.6874, region: "mountain" },
  { id: 7,  name: "Eastern Idaho (Idaho Falls)", lat: 43.4917, lng: -112.0339, region: "mountain" },
  { id: 8,  name: "Palisade, CO",               lat: 39.1097, lng: -108.3506, region: "mountain" },
  { id: 9,  name: "McAllen / Pharr, TX",        lat: 26.2034, lng:  -98.2300, region: "border" },
  { id: 10, name: "Laredo, TX",                 lat: 27.5306, lng:  -99.4803, region: "border" },
  { id: 11, name: "Nogales, AZ",                lat: 31.3404, lng: -110.9343, region: "border" },
  { id: 12, name: "Vidalia, GA",                lat: 32.2179, lng:  -82.4135, region: "southeast" },
  { id: 13, name: "New Jersey produce belt",    lat: 39.6365, lng:  -74.8024, region: "northeast" },
  { id: 14, name: "Western Michigan fruit belt", lat: 42.9634, lng:  -85.6681, region: "greatlakes" }
];

const REGION_CALLOUTS = {
  pnw: {
    title: "Pacific Northwest",
    body: "Above-normal temperatures favored, with below-normal precipitation. Cherry, stone fruit, and apple harvests likely to run earlier than the 5-year average. Plan for a compressed pack window in July and tender outbound capacity ahead of normal timing."
  },
  california: {
    title: "California",
    body: "Above-normal temperatures favored across the Central Valley and Salinas. Stone fruit, table grape, and tomato pack windows may compress in August. Salinas leafy greens expected to maintain typical pace barring heat events. Watch for short-notice tender pulls during heat spikes."
  },
  mountain: {
    title: "Northwest & Mountain States",
    body: "Above-normal temperatures with mixed precipitation signals. Idaho potato and Treasure Valley onion harvests expected on or slightly ahead of typical late-August start. Heat stress during fill periods carries quality risk; plan for steady September outbound volume."
  },
  border: {
    title: "South Central & Border Region",
    body: "Above-normal temperatures with above-normal precipitation favored across South Texas. Mexican cross-border produce volume accelerates through Laredo, Pharr, and Nogales in September. Heat and humidity may pressure quality on hand-loaded perishables. Expect tight capacity at southern crossings."
  },
  southeast: {
    title: "Southeast",
    body: "Above-normal temperatures with elevated precipitation odds. Vidalia onion harvest concludes in early Q3; secondary impact from hurricane season risk remains the larger Q3 watch item for this region."
  },
  northeast: {
    title: "Northeast",
    body: "Near-normal to slightly above-normal temperatures favored. New Jersey peaches and blueberries and regional sweet corn expected to maintain typical seasonal pace."
  },
  greatlakes: {
    title: "Great Lakes",
    body: "Near-normal temperatures favored. Michigan tart cherries, blueberries, and apples expected on typical timing. Lowest forecast-disruption region in the Q3 outlook."
  }
};

const DEFAULT_CALLOUT = {
  title: "Q3 Macro Outlook",
  body: "NOAA's July–September 2026 outlook favors above-normal temperatures across most of the U.S. growing belt, with developing El Niño conditions tilting precipitation drier across the Pacific Northwest and wetter across the southern tier. Expect compressed harvest windows in the West, more typical pacing in the Midwest and Northeast. Hover a region for the specific freight implications."
};
