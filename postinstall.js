const envfile = require("envfile");
const fs = require("graceful-fs");
const os = require("os");

const isAnyfiddle = os.userInfo().username === "anyfiddle" && process.cwd() === "/home/anyfiddle/project";

if (!fs.existsSync(".env")) {
  fs.copyFileSync("sample.env", ".env");
  if (isAnyfiddle) {
    const fenv = envfile.parse(fs.readFileSync(".env"));
    fenv.CA_HTTP_HOST = "0.0.0.0";
    fenv.CA_HTTP_PORT = "8080";
    fs.writeFileSync(".env", envfile.stringify(fenv));
  }
}

if (!fs.existsSync("ecosystem.config.js")) {
  fs.copyFileSync("sample.ecosystem.config.js", "ecosystem.config.js");
}

if (!fs.existsSync("runtime")) {
  fs.mkdirSync("runtime");
}
