#!/usr/bin/env node
/**
 * Seed Supabase `venues` table from hardcoded app data in src/data/venues.ts.
 *
 * Sources:
 * - CITY_VENUES => venue_type: "lunch_dinner"
 * - CITY_BARS   => venue_type: "drinks"
 *
 * Required env vars:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node --env-file=.env scripts/seed-venues-from-venue-data.mjs
 *
 * Dry run:
 *   DRY_RUN=1 node --env-file=.env scripts/seed-venues-from-venue-data.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

/** @typedef {'lunch_dinner' | 'drinks'} VenueType */

/**
 * @typedef {Object} SeedRow
 * @property {string} city
 * @property {string} name
 * @property {string} address
 * @property {VenueType} venue_type
 * @property {boolean} is_active
 * @property {number} sort_order
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function keyOf(row) {
  return [
    normalize(row.city).toLowerCase(),
    normalize(row.name).toLowerCase(),
    normalize(row.address).toLowerCase(),
    row.venue_type,
  ].join("|");
}

/**
 * Extracts the object literal assigned to an exported const (e.g. CITY_VENUES)
 * by scanning braces while respecting strings/comments.
 */
function extractExportedObjectLiteral(source, exportConstName) {
  const marker = `export const ${exportConstName}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Could not find export const ${exportConstName} in src/data/venues.ts`);
  }

  const equalsIndex = source.indexOf("=", markerIndex);
  if (equalsIndex === -1) {
    throw new Error(`Could not parse assignment for ${exportConstName}`);
  }

  const startBrace = source.indexOf("{", equalsIndex);
  if (startBrace === -1) {
    throw new Error(`Could not find object start for ${exportConstName}`);
  }

  let i = startBrace;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }

    if (inDouble) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }

    if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") inTemplate = false;
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      i++;
      continue;
    }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(startBrace, i + 1);
      }
    }

    i++;
  }

  throw new Error(`Unbalanced braces while parsing ${exportConstName}`);
}

function evaluateObjectLiteral(objectLiteralText, exportConstName) {
  try {
    return vm.runInNewContext(`(${objectLiteralText})`, Object.create(null), {
      timeout: 1_000,
      filename: `${exportConstName}.literal.js`,
    });
  } catch (error) {
    throw new Error(`Failed to evaluate ${exportConstName}: ${error?.message || error}`);
  }
}

async function loadVenueSources() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const venuesFilePath = path.resolve(here, "../src/data/venues.ts");
  const source = await fs.readFile(venuesFilePath, "utf8");

  const cityVenuesLiteral = extractExportedObjectLiteral(source, "CITY_VENUES");
  const cityBarsLiteral = extractExportedObjectLiteral(source, "CITY_BARS");

  const CITY_VENUES = evaluateObjectLiteral(cityVenuesLiteral, "CITY_VENUES");
  const CITY_BARS = evaluateObjectLiteral(cityBarsLiteral, "CITY_BARS");

  if (!CITY_VENUES || typeof CITY_VENUES !== "object") {
    throw new Error("Parsed CITY_VENUES is invalid");
  }
  if (!CITY_BARS || typeof CITY_BARS !== "object") {
    throw new Error("Parsed CITY_BARS is invalid");
  }

  return { CITY_VENUES, CITY_BARS };
}

/** @returns {Promise<SeedRow[]>} */
async function buildSeedRows() {
  const { CITY_VENUES, CITY_BARS } = await loadVenueSources();

  /** @type {SeedRow[]} */
  const rows = [];

  for (const [city, venues] of Object.entries(CITY_VENUES)) {
    venues.forEach((venue, index) => {
      rows.push({
        city,
        name: venue.name,
        address: venue.address,
        venue_type: "lunch_dinner",
        is_active: true,
        sort_order: index + 1,
      });
    });
  }

  for (const [city, bars] of Object.entries(CITY_BARS)) {
    bars.forEach((bar, index) => {
      rows.push({
        city,
        name: bar.name,
        address: bar.address,
        venue_type: "drinks",
        is_active: true,
        sort_order: index + 1,
      });
    });
  }

  const deduped = new Map();
  for (const row of rows) {
    deduped.set(keyOf(row), row);
  }

  return [...deduped.values()];
}

async function fetchExistingKeys() {
  const { data, error } = await supabase
    .from("venues")
    .select("city,name,address,venue_type");

  if (error) {
    throw new Error(`Failed to read existing venues: ${error.message}`);
  }

  const keys = new Set();
  for (const row of data ?? []) {
    keys.add(
      keyOf({
        city: row.city,
        name: row.name,
        address: row.address,
        venue_type: row.venue_type,
      })
    );
  }

  return keys;
}

async function insertInBatches(rows, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from("venues").insert(batch);
    if (error) {
      throw new Error(`Insert failed at rows ${i + 1}-${i + batch.length}: ${error.message}`);
    }
    console.log(`Inserted ${i + 1}-${i + batch.length} of ${rows.length}`);
  }
}

async function main() {
  const allSeedRows = await buildSeedRows();
  const existingKeys = await fetchExistingKeys();

  const rowsToInsert = allSeedRows.filter((row) => !existingKeys.has(keyOf(row)));

  console.log("Venue seed summary:", {
    totalFromData: allSeedRows.length,
    alreadyInDb: allSeedRows.length - rowsToInsert.length,
    toInsert: rowsToInsert.length,
    dryRun: DRY_RUN,
  });

  if (rowsToInsert.length === 0) {
    console.log("No new rows to insert.");
    return;
  }

  if (DRY_RUN) {
    console.log("DRY_RUN enabled. No changes were made.");
    return;
  }

  await insertInBatches(rowsToInsert);
  console.log("Seeding complete.");
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
