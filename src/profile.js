import { CaProfile } from "@ndn/ndncert";
import { Encoder } from "@ndn/tlv";

import { env, keyChain, modifyEnv, profile } from "./env.js";
import { handleError, message, nameFromHex, template } from "./helper.js";
import { require } from "./require.js";
/** @type {import("graceful-fs")} */
const { promises: fs } = require("graceful-fs");

/** @type {import("express").Handler} */
async function download(req, res) {
  if (!profile) {
    res.status(404);
    res.end();
    return;
  }
  res.contentType("application/octet-stream");
  res.write(Buffer.from(Encoder.encode(profile.data)));
  res.end();
}

/** @type {import("express").Handler} */
async function show(req, res) {
  if (!profile) {
    res.status(404);
    res.end();
    return;
  }
  res.contentType("text/plain");
  res.write(`${profile}`);
  res.end();
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
  const signer = await keyChain.getPrivateKey(cert.certName.toKeyName().toName());
  const info = String(req.body.info).trim();
  const maxValidityPeriod = 86400000 * Number.parseInt(req.body.validdays, 10);
  const profile = await CaProfile.build({
    prefix: cert.certName.subjectName.append("CA"),
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
    CA_CHALLENGES: challenges,
  });
}

/** @param {import("express").Express} app */
export function register(app) {
  app.get("/profile.data", handleError(download));
  app.get("/profile.txt", handleError(show));

  app.get("/profile-new.html", handleError(newForm));
  app.post("/profile-new.cgi", handleError(newSubmit));
}
