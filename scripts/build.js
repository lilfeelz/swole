import fs from "node:fs/promises";
import path from "node:path";
import esbuild from "esbuild";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

const b64 = async (f) =>
  (await fs.readFile(path.join(rootDir, "workline", f))).toString("base64");
const logs = (
  await fs.readdir(path.join(rootDir, "sample", "log"), { recursive: true })
)
  .filter((f) => f.endsWith(".txt"))
  .sort();
/** Constants every bundle gets: both wasm files and the public sample. */
const define = {
  WORKLINE_WASM: JSON.stringify(await b64("workline.wasm")),
  TS_WASM: JSON.stringify(await b64("web-tree-sitter.wasm")),
  SWOLE_SAMPLE: JSON.stringify({
    routine: await fs.readFile(
      path.join(rootDir, "sample", "routine.txt"),
      "utf8",
    ),
    logs: await Promise.all(
      logs.map((f) =>
        fs.readFile(path.join(rootDir, "sample", "log", f), "utf8"),
      ),
    ),
  }),
};

/**
 * Bundles the UI for one browser runtime into dist/<name>.
 *
 * @param {string} name Runtime name under src/runtimes.
 * @param {string} [banner] HTML replacing the DEMO_BANNER marker.
 * @returns {Promise<string>} Output directory.
 */
async function web(name, banner = "") {
  const out = path.join(distDir, name);
  await fs.mkdir(out, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "runtimes", name, "main.js")],
    bundle: true,
    format: "iife",
    target: "es2022",
    define,
    // workline's import.meta fallback is unused: bundles always pass wasm bytes.
    logOverride: { "empty-import-meta": "silent" },
    outfile: path.join(out, "app.js"),
    minify: true,
  });
  const html = await fs.readFile(
    path.join(rootDir, "src", "ui", "index.html"),
    "utf8",
  );
  await fs.writeFile(
    path.join(out, "index.html"),
    html.replace("<!-- DEMO_BANNER -->", banner),
  );
  await fs.copyFile(
    path.join(rootDir, "src", "ui", "styles.css"),
    path.join(out, "styles.css"),
  );
  console.log(`built dist/${name}`);
  return out;
}

/**
 * Builds all swole distribution artifacts.
 */
async function build() {
  console.log("Building swole...");

  await fs.mkdir(distDir, { recursive: true });

  await web("local");
  const apkDist = await web("apk");
  await web(
    "demo",
    '<div class="demo-banner">Interactive Demo &bull; <a href="https://github.com/lilfeelz/swole" target="_blank" rel="noopener">swole on GitHub</a></div>',
  );

  // 2. Android assets
  const androidAssets = path.join(
    rootDir,
    "android",
    "app",
    "src",
    "main",
    "assets",
  );
  await fs.mkdir(androidAssets, { recursive: true });
  await fs.rm(androidAssets, { recursive: true, force: true });
  await fs.cp(apkDist, androidAssets, { recursive: true });
  console.log("✔ Synced android/app/src/main/assets");

  // Apps Script: Code.js (server) plus one Index.html with the client inlined, since it serves no other files.
  const gasDist = await web("gas");
  const inline = async (f) => fs.readFile(path.join(gasDist, f), "utf8");
  const css = await inline("styles.css");
  const js = (await inline("app.js")).replace(/<\/script/gi, "<\\/script");
  const page = (await inline("index.html"))
    .replace(
      '<link rel="stylesheet" href="./styles.css" />',
      () => `<style>\n${css}\n</style>`,
    )
    .replace(
      '<script src="./app.js"></script>',
      () => `<script>\n${js}\n</script>`,
    );
  for (const f of ["index.html", "app.js", "styles.css"])
    await fs.rm(path.join(gasDist, f));
  // After the rm: on a case-insensitive disk Index.html and index.html are one file.
  await fs.writeFile(path.join(gasDist, "Index.html"), page);
  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "runtimes", "gas", "Code.js")],
    bundle: true,
    format: "iife",
    globalName: "SwoleGas",
    target: "es2020",
    outfile: path.join(gasDist, "Code.js"),
    footer: {
      js: ["doGet", "apiLoad", "apiStart", "apiStop", "apiSave", "apiTrack"]
        .map((f) => `function ${f}(...a) { return SwoleGas.${f}(...a); }`)
        .join("\n"),
    },
  });
  await fs.copyFile(
    path.join(rootDir, "src", "runtimes", "gas", "appsscript.json"),
    path.join(gasDist, "appsscript.json"),
  );
  console.log("built dist/gas");

  // 5. Cloudflare Workers bundle (dist/cf/worker.js)
  const cfDist = path.join(distDir, "cf");
  await fs.mkdir(cfDist, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "runtimes", "cf", "worker.js")],
    bundle: true,
    format: "esm",
    target: "es2022",
    outfile: path.join(cfDist, "worker.js"),
    minify: true,
  });
  console.log("✔ Built dist/cf/worker.js");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
