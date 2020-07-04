const fs = require("graceful-fs");

if (!fs.existsSync(".env")) {
  fs.copyFileSync("sample.env", ".env");
}

if (!fs.existsSync("ecosystem.config.js")) {
  fs.copyFileSync("sample.ecosystem.config.js", "ecosystem.config.js");
}

if (!fs.existsSync("runtime")) {
  fs.mkdirSync("runtime");
}
