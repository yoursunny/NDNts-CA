import bodyParser from "body-parser";
import express from "express";

import { env, initialize, profile, recentPinRequests } from "./env.js";
import { registerViewHelpers, template } from "./helper.js";
import { register as keychainRoutes } from "./keychain.js";
import { register as manualRoutes } from "./manual.js";
import { register as profileRoutes } from "./profile.js";

(async () => {
await initialize();

const app = express();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.locals.profile = profile;
registerViewHelpers(app);
app.set("view engine", "ejs");
app.get("/", template("frontpage", { recentPinRequests }));

profileRoutes(app);
keychainRoutes(app);
manualRoutes(app);

app.listen(env.httpport);
console.log(`http://localhost:${env.httpport}`);
})();
