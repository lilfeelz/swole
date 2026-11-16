import fs from "node:fs/promises";
import path from "node:path";
import esbuild from "esbuild";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");

/**
 * Builds all swole distribution artifacts.
 */
async function build() {
  console.log("Building swole...");

  await fs.mkdir(distDir, { recursive: true });

  // 1. Web bundle (dist/web)
  const webDist = path.join(distDir, "web");
  await fs.mkdir(webDist, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "ui", "app.js")],
    bundle: true,
    format: "esm",
    target: "es2022",
    outfile: path.join(webDist, "app.js"),
    minify: true,
  });

  await fs.copyFile(
    path.join(rootDir, "src", "ui", "index.html"),
    path.join(webDist, "index.html"),
  );
  await fs.copyFile(
    path.join(rootDir, "src", "ui", "styles.css"),
    path.join(webDist, "styles.css"),
  );
  console.log("✔ Built dist/web");

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

  // 4. CLI executable (dist/cli.js)
  await esbuild.build({
    entryPoints: [path.join(rootDir, "src", "cli.js")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    banner: { js: "#!/usr/bin/env node" },
    outfile: path.join(distDir, "cli.js"),
  });
  await fs.chmod(path.join(distDir, "cli.js"), 0o755);
  console.log("✔ Built dist/cli.js");

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
