#!/usr/bin/env node
// Merges messages/_partials/*.json into messages/en.json and messages/pt.json.
// Each partial: { "en": { "<ns>": {...} }, "pt": { "<ns>": {...} } }
// Preserves existing namespaces (common, home). Validates EN/PT key parity.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, "..", "src", "messages");
const partialsDir = join(messagesDir, "_partials");

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (isObj(source[key]) && isObj(target[key])) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function flatKeys(obj, prefix = "") {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isObj(v)) out.push(...flatKeys(v, path));
    else out.push(path);
  }
  return out;
}

function sortDeep(obj) {
  if (!isObj(obj)) return obj;
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = sortDeep(obj[k]);
  return sorted;
}

const en = JSON.parse(readFileSync(join(messagesDir, "en.json"), "utf8"));
const pt = JSON.parse(readFileSync(join(messagesDir, "pt.json"), "utf8"));

if (!existsSync(partialsDir)) {
  console.error("No _partials dir found at", partialsDir);
  process.exit(1);
}

const partialFiles = readdirSync(partialsDir).filter((f) => f.endsWith(".json"));
const report = [];
const parityIssues = [];

for (const file of partialFiles.sort()) {
  const raw = JSON.parse(readFileSync(join(partialsDir, file), "utf8"));
  const ns = file.replace(/\.json$/, "");
  const enPart = raw.en || {};
  const ptPart = raw.pt || {};
  deepMerge(en, enPart);
  deepMerge(pt, ptPart);

  // parity check on this namespace
  const enNs = (enPart[ns] ?? enPart[Object.keys(enPart)[0]]) || {};
  const ptNs = (ptPart[ns] ?? ptPart[Object.keys(ptPart)[0]]) || {};
  const enKeys = new Set(flatKeys(enNs));
  const ptKeys = new Set(flatKeys(ptNs));
  const missingInPt = [...enKeys].filter((k) => !ptKeys.has(k));
  const missingInEn = [...ptKeys].filter((k) => !enKeys.has(k));
  if (missingInPt.length || missingInEn.length) {
    parityIssues.push({ ns, missingInPt, missingInEn });
  }
  report.push({ ns, enKeyCount: enKeys.size, ptKeyCount: ptKeys.size });
}

const enSorted = sortDeep(en);
const ptSorted = sortDeep(pt);
writeFileSync(join(messagesDir, "en.json"), JSON.stringify(enSorted, null, 2) + "\n");
writeFileSync(join(messagesDir, "pt.json"), JSON.stringify(ptSorted, null, 2) + "\n");

console.log("Merged partials:", partialFiles.length);
console.table(report);
console.log("Top-level namespaces (en):", Object.keys(enSorted).sort().join(", "));
console.log("Total leaf keys — en:", flatKeys(enSorted).length, "pt:", flatKeys(ptSorted).length);
if (parityIssues.length) {
  console.log("\n⚠️  EN/PT parity issues:");
  for (const p of parityIssues) {
    console.log(`  [${p.ns}] missing in pt: ${p.missingInPt.join(", ") || "-"} | missing in en: ${p.missingInEn.join(", ") || "-"}`);
  }
  process.exitCode = 2;
} else {
  console.log("\n✅ EN/PT key parity OK for all merged namespaces.");
}
