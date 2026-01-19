import fs from "fs";
import path from "path";

const pathsToClean = [
  path.resolve(__dirname, "../../packages/types/kubb"),
  path.resolve(__dirname, "../web/src/kubb/hooks"),
];

pathsToClean.forEach((targetPath) => {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    console.log(`✅ Removed: ${targetPath}`);
  } else {
    console.log(`⚠️  Path not found: ${targetPath}`);
    // Show the contents of the parent directory
    const parentDir = path.dirname(targetPath);
    if (fs.existsSync(parentDir)) {
      const files = fs.readdirSync(parentDir);
      console.log(`📂 Contents of parent directory (${parentDir}):`);
      files.forEach((file) => console.log("  -", file));
    } else {
      console.log(`❌ Parent directory not found: ${parentDir}`);
    }
  }
});

console.log("🧹 Kubb cleaned");
