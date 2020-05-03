import express from "express";

import { env, initialize, profile, recentPinRequests } from "./env.js";
import { message, registerViewHelpers, template } from "./helper.js";
import { register as keychainRoutes } from "./keychain.js";
import { register as manualRoutes } from "./manual.js";
import { register as profileRoutes } from "./profile.js";

(async () => {
await initialize();

const app = express();
app.use(express.urlencoded({ extended: true }));

app.locals.profile = profile;
registerViewHelpers(app);
app.set("view engine", "ejs");
app.get("/", template("frontpage", { challenges: env.challenges, recentPinRequests }));

profileRoutes(app);
keychainRoutes(app);
manualRoutes(app);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400);
  message(err.toString(), { title: "Error", next: "back" })(req, res);
});
app.use(express.static("public"));
app.listen(env.httpport);
console.log(`http://localhost:${env.httpport}`);
})();
