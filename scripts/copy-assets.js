// 把渲染层静态资源（index.html / styles.css）复制到 dist/renderer/。
// tsc 只编译 .ts，不会复制非 TS 文件，需手动补一步。
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "src", "renderer");
const destDir = path.join(root, "dist", "renderer");

fs.mkdirSync(destDir, { recursive: true });

const assets = ["index.html", "styles.css"];
for (const name of assets) {
  fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name));
  console.log("copied", name, "->", path.relative(root, path.join(destDir, name)));
}
