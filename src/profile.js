import { CertNaming } from "@ndn/keychain";
import { CaProfile } from "@ndn/ndncert";
import { Encoder } from "@ndn/tlv";
import module from "module";

import { env, keyChain, modifyEnv, profile } from "./env.js";
import { handleError, message, nameFromHex, template } from "./helper.js";

export const require = module.createRequire(import.meta.url);
/** @type {import("graceful-fs")} */
const { promises: fs } = require("graceful-fs");

/** @type {import("express").Handler} */
async function download(req, res) {
  if (!profile) {
    res.status(404).end();
    return;
  }
  res.contentType("application/octet-stream");
  res.send(Buffer.from(Encoder.encode(profile.data)));
}

/** @type {import("express").Handler} */
async function view(req, res) {
  return template("profile-view")(req, res);
}

/** @type {import("express").Handler} */
async function newForm(req, res) {
  template("profile-new", {
    certNames: await keyChain.listCerts(),
  })(req, res);
}

/** @type {import("express").Handler} */
async function newSubmit(req, res) {
  const challenges = ["nop", "pin"].filter((challenge) => req.body[`challenge-${challenge}`] === "1");
  if (challenges.length === 0) {
    message("At least one challenge is required.", { next: "back" })(req, res);
    return;
  }

  const cert = await keyChain.getCert(nameFromHex(req.body.cert));
  const signer = await keyChain.getPrivateKey(CertNaming.toKeyName(cert.name));
  const info = String(req.body.info).trim();
  const maxValidityPeriod = 86400000 * Number.parseInt(req.body.validdays, 10);
  const profile = await CaProfile.build({
    prefix: CertNaming.toSubjectName(cert.name).append("CA"),
    info,
    probeKeys: [],
    maxValidityPeriod,
    cert,
    signer,
  });
  await fs.writeFile(env.profile, Encoder.encode(profile.data));

  message("Profile saved, restarting server.")(req, res);
  res.end();

  const keyName = signer.name.toString();
  await modifyEnv({
    NDNTS_KEY: keyName,
    NDNTS_NFDREGKEY: keyName,
    CA_KEY: keyName,
    CA_CHALLENGES: challenges.join(),
  });
}

/** @param {import("express").Express} app */
export function register(app) {
  app.get("/profile.html", handleError(view));
  app.get("/profile.data", handleError(download));

  app.get("/profile-new.html", handleError(newForm));
  app.post("/profile-new.cgi", handleError(newSubmit));
}
