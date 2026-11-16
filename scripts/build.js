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
  const webDist = await web(
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
  await fs.cp(webDist, androidAssets, { recursive: true });
  console.log("✔ Synced android/app/src/main/assets");

  // 3. Google Apps Script bundle (dist/gas)
  const gasDist = path.join(distDir, "gas");
  await fs.mkdir(gasDist, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "runtimes", "gas", "Code.js")],
    bundle: true,
    format: "iife",
    globalName: "SwoleGas",
    target: "es2020",
    outfile: path.join(gasDist, "Code.js"),
  });

  // Append global exports for GAS entrypoints
  const gasExports = `
function doGet() { return SwoleGas.doGet(); }
function include(name) { return SwoleGas.include(name); }
function apiLoad(day) { return SwoleGas.apiLoad(day); }
function apiSave(session) { return SwoleGas.apiSave(session); }
`;
  await fs.appendFile(path.join(gasDist, "Code.js"), gasExports, "utf8");

  await fs.copyFile(
    path.join(rootDir, "src", "runtimes", "gas", "appsscript.json"),
    path.join(gasDist, "appsscript.json"),
  );

  // Inlined Index.html for GAS
  const htmlRaw = await fs.readFile(
    path.join(rootDir, "src", "ui", "index.html"),
    "utf8",
  );
  const cssRaw = await fs.readFile(
    path.join(rootDir, "src", "ui", "styles.css"),
    "utf8",
  );
  const jsRaw = await fs.readFile(path.join(webDist, "app.js"), "utf8");

  const inlinedGasHtml = htmlRaw
    .replace(
      '<link rel="stylesheet" href="./styles.css" />',
      `<style>\n${cssRaw}\n</style>`,
    )
    .replace(
      '<script type="module" src="./app.js"></script>',
      `<script>\n${jsRaw}\n</script>`,
    );

  await fs.writeFile(path.join(gasDist, "Index.html"), inlinedGasHtml, "utf8");
  console.log("✔ Built dist/gas");

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
