// Usage: node scripts/snapshot.mjs [version]   (builds current tree as frozen snapshot, regenerates manifest)
//        node scripts/snapshot.mjs --manifest  (manifest only)
import { execSync } from "node:child_process";
import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const arg = process.argv[2];
if (arg !== "--manifest") {
  const ver = arg || pkg.version;
  execSync(`npx vite build --outDir public/versions/${ver} --emptyOutDir`, {
    stdio: "inherit", env: { ...process.env, SNAPSHOT: "1" },
  });
}
const cmp = (a, b) => a.split(".").map(Number).reduce((r, x, i) => r || x - b.split(".").map(Number)[i], 0);
const prev = fs.existsSync("public/versions/manifest.json")
  ? Object.fromEntries(JSON.parse(fs.readFileSync("public/versions/manifest.json", "utf8")).versions.map((x) => [x.version, x.date]))
  : {};
const out = [];
for (const f of fs.readdirSync(".")) {
  const m = f.match(/^NOTES-(\d+\.\d+\.\d+)\.md$/);
  if (!m) continue;
  const v = m[1];
  const title = fs.readFileSync(f, "utf8").split("\n")[0].replace(/^#\s*/, "").replace(/^[\d.]+\s*[—-]\s*/, "");
  const dir = `public/versions/${v}`;
  const available = fs.existsSync(`${dir}/index.html`);
  // Keep a version's first recorded date (mtimes change when the tree is copied/extracted).
  const date = available ? (prev[v] || fs.statSync(`${dir}/index.html`).mtime.toISOString().slice(0, 10)) : null;
  out.push({ version: v, summary: title, available, date, path: available ? `versions/${v}/index.html` : null,
    reason: available ? undefined : "Build not recoverable on the box (no tarball/source kept for this version)." });
}
out.sort((a, b) => cmp(b.version, a.version));
fs.mkdirSync("public/versions", { recursive: true });
fs.writeFileSync("public/versions/manifest.json", JSON.stringify({ live: pkg.version, versions: out }, null, 2));
console.log(`manifest: ${out.filter((x) => x.available).length}/${out.length} available`);
