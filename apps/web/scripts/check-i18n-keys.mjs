#!/usr/bin/env node
// Static audit: every literal t("key") / c("key") / t.rich("key") in source must
// resolve to an existing key in messages/en.json (and pt.json). Heuristic — it
// only checks string-literal keys (skips dynamic/template-literal keys).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src");
const messagesDir = join(srcDir, "messages");

const en = JSON.parse(readFileSync(join(messagesDir, "en.json"), "utf8"));
const pt = JSON.parse(readFileSync(join(messagesDir, "pt.json"), "utf8"));

function hasKey(obj, path) {
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj) !== undefined;
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "messages" || name === "node_modules" || name === "_partials") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(full);
  }
  return acc;
}

const files = walk(srcDir);
const misses = [];
let checked = 0;

// match: const X = useTranslations("ns")  |  const X = await getTranslations("ns")
//        const X = useTranslations()      (root namespace -> ns = "")
const bindRe = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g;

for (const file of files) {
  const code = readFileSync(file, "utf8");
  const varToNs = {};
  let m;
  bindRe.lastIndex = 0;
  while ((m = bindRe.exec(code))) {
    const varName = m[1];
    const ns = m[2] ?? m[3] ?? "";
    varToNs[varName] = ns;
  }
  if (Object.keys(varToNs).length === 0) continue;

  for (const [varName, ns] of Object.entries(varToNs)) {
    // VAR("key")  and  VAR.rich("key")  and VAR.markup("key")
    const callRe = new RegExp(
      `\\b${varName}(?:\\.(?:rich|markup))?\\(\\s*(?:"([^"]*)"|'([^']*)')`,
      "g"
    );
    let c;
    while ((c = callRe.exec(code))) {
      const key = c[1] ?? c[2];
      if (key === undefined) continue;
      checked++;
      const full = ns ? `${ns}.${key}` : key;
      const inEn = hasKey(en, full);
      const inPt = hasKey(pt, full);
      if (!inEn || !inPt) {
        misses.push({
          file: relative(srcDir, file),
          var: varName,
          ns,
          key,
          full,
          missingEn: !inEn,
          missingPt: !inPt,
        });
      }
    }
  }
}

console.log(`Checked ${checked} literal translation calls across ${files.length} source files.`);
if (misses.length === 0) {
  console.log("✅ All literal translation keys resolve in both en.json and pt.json.");
} else {
  console.log(`\n❌ ${misses.length} missing key(s):`);
  for (const x of misses) {
    const where = [x.missingEn ? "en" : null, x.missingPt ? "pt" : null].filter(Boolean).join("+");
    console.log(`  [${x.file}] ${x.var}("${x.key}") -> "${x.full}" missing in: ${where}`);
  }
  process.exitCode = 1;
}
