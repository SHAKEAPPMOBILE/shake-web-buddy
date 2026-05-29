import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
const out = resolve(__dirname, "../public/version.json");
writeFileSync(out, JSON.stringify({ version: pkg.version }, null, 2) + "\n");
console.log(`[write-version] public/version.json → ${pkg.version}`);
