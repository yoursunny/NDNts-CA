import { Certificate, CertNaming, ValidityPeriod } from "@ndn/keychain";
import { Component } from "@ndn/packet";
import { toHex } from "@ndn/tlv";

import { keyChain, repo } from "./env.js";
import { certFromBase64, handleError, nameFromHex, template } from "./helper.js";

/** @type {import("express").Handler} */
async function requestForm(req, res) {
  template("manual-request", {
    certNames: await keyChain.listCerts(),
  })(req, res);
}

/** @type {import("express").Handler} */
async function requestSubmit(req, res) {
  const certreq = certFromBase64(req.body.certreq);
  const publicKey = await certreq.loadPublicKey();
  const issuer = await keyChain.getCert(nameFromHex(req.body.issuer));
  const issuerPrivateKey = await keyChain.getPrivateKey(CertNaming.toKeyName(issuer.name));
  const validDays = Number.parseInt(req.body.validdays, 10);
  const cert = await Certificate.issue({
    issuerPrivateKey,
    publicKey,
    issuerId: Component.from("NDNts-Personal-CA"),
    validity: ValidityPeriod.daysFromNow(validDays),
  });

  await repo.insert(cert.data);
  res.redirect(`manual-issued.html?name=${toHex(cert.name.value)}`);
}

/** @type {import("express").Handler} */
async function viewIssued(req, res) {
  const name = nameFromHex(String(req.query.name));
  const cert = Certificate.fromData(await repo.get(name));
  template("manual-issued", { cert })(req, res);
}

/** @param {import("express").Express} app */
export function register(app) {
  app.get("/manual-request.html", handleError(requestForm));
  app.post("/manual-submit.cgi", handleError(requestSubmit));
  app.get("/manual-issued.html", handleError(viewIssued));
}
