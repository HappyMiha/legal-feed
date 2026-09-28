import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = "dist/client";
if (!existsSync(root))
  throw Error("Build the client before generating the offline shell.");
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
const files = walk(root)
  .filter(
    (f) =>
      !f.endsWith("sw.js") &&
      !f.endsWith(".map") &&
      !path
        .relative(root, f)
        .split(path.sep)
        .some((part) => part.startsWith(".")) &&
      !["_headers", "_redirects", "vinext-client-entry-manifest.json"].includes(
        path.basename(f),
      ),
  )
  .map((f) => "/" + path.relative(root, f));
const hash = createHash("sha256");
for (const file of files) hash.update(readFileSync(root + file));
const version = hash.digest("hex").slice(0, 16);
const sw = `const CACHE='helvetic-lens-aix-${version}';const ASSETS=${JSON.stringify(["/", ...files])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('helvetic-lens-aix-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/')));return;}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));});`;
writeFileSync(root + "/sw.js", sw);
console.log(
  "AIx offline shell generated for " + files.length + " local assets.",
);
