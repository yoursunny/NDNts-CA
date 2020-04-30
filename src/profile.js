import { CaProfile } from "@ndn/ndncert";
import { Data, Name } from "@ndn/packet";
import { Encoder } from "@ndn/tlv";

import { env, keyChain, modifyEnv, profile } from "./env.js";
import { message } from "./helper.js";
import { require } from "./require.js";
/** @type import("graceful-fs") */
const { promises: fs } = require("graceful-fs");

/** @type {import("express").Handler} */
export async function download(req, res) {
  if (!profile) {
    res.status(404);
    res.end();
    return;
  }
  res.contentType("application/octet-stream");
  res.write(Data.getWire(profile.data));
  res.end();
}

/** @type {import("express").Handler} */
export async function show(req, res) {
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
  res.render("profile-new", {
    certNames: await keyChain.listCerts(),
  });
}

/** @type {import("express").Handler} */
async function newSubmit(req, res) {
  const cert = await keyChain.getCert(new Name(req.body.cert));
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
  });
}

/** @param {import("express").Express} app */
export function register(app) {
  app.get("/profile.data", download);
  app.get("/profile.txt", show);

  app.get("/profile-new.html", newForm);
  app.post("/profile-new.cgi", newSubmit);
}
