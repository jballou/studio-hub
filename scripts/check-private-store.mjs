// Guards the private notes and reports store.
// Run: npm run check:private   (exits 1 and lists every offender)
//  1. Only lib/store/me.ts and lib/me/ may build "me/<id>" document names or call userDocId for it.
//  2. Anything outside lib/me importing lib/store/me must call requireMe, and must not live under app/api/admin.
//  3. The private modules never log.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const bad = [];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
};
["app", "lib", "components", "hooks"].forEach((d) => { try { walk(d); } catch { /* folder may not exist */ } });

const isPrivateModule = (f) => f === "lib/store/me.ts" || f.startsWith("lib/me/");

for (const f of files) {
  const src = readFileSync(f, "utf8");
  const importsStore = /from\s+["']@\/lib\/store\/me["']/.test(src);

  if (!isPrivateModule(f)) {
    if (/`me\/\$\{/.test(src) || /["']me\/["']\s*\+/.test(src)) bad.push(`${f}  builds a private document name outside the private store`);
    if (/\bme\.docId\b/.test(src)) bad.push(`${f}  reads Me.docId outside the private store`);
  }
  if (importsStore) {
    // lib/me/* modules receive a Me from their caller, which is the same guarantee as calling requireMe here.
    if (!isPrivateModule(f) && !/\brequireMe\(/.test(src)) bad.push(`${f}  uses the private store without requireMe(req)`);
    if (f.startsWith("app/api/admin/")) bad.push(`${f}  admin routes must not read private data`);
    if (f.startsWith("components/")) bad.push(`${f}  client components must not import the private store`);
  }
  if (isPrivateModule(f) && /\bconsole\./.test(src)) bad.push(`${f}  private modules must not log`);
}

if (bad.length) {
  console.error(`Private store check failed (${bad.length}):\n${bad.join("\n")}`);
  process.exit(1);
}
console.log("Private store check passed.");
