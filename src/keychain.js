import { Certificate, EcPrivateKey, ValidityPeriod } from "@ndn/keychain";
import { AltUri } from "@ndn/naming-convention2";
import { NdnsecKeyChain } from "@ndn/ndnsec";
import { Name } from "@ndn/packet";

import { keyChain } from "./env.js";
import { certFromBase64, handleError, message, nameFromHex, template } from "./helper.js";

const KEYCHAIN_LIST_URI = "keychain-list.html";

/** @type {import("express").Handler} */
async function list(req, res) {
  template("keychain-list", {
    keyNames: await keyChain.listKeys(),
    certNames: await keyChain.listCerts(),
  })(req, res);
}

/** @type {import("express").Handler} */
async function deleteKey(req, res) {
  const name = nameFromHex(req.body.name);
  await keyChain.deleteKey(name);
  message(`Key ${AltUri.ofName(name)} deleted.`,
    { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @type {import("express").Handler} */
async function deleteCert(req, res) {
  const name = nameFromHex(req.body.name);
  await keyChain.deleteCert(name);
  message(`Certificate ${AltUri.ofName(name)} deleted.`,
    { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @type {import("express").Handler} */
async function selfSign(req, res) {
  const name = nameFromHex(req.body.name);
  const [privateKey, publicKey] = await keyChain.getKeyPair(name);
  const cert = await Certificate.selfSign({ privateKey, publicKey });
  await keyChain.insertCert(cert);
  message(`Self-signed certificate ${AltUri.ofName(cert.name)} created.`,
    { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @type {import("express").Handler} */
async function genKey(req, res) {
  const name = new Name(req.body.name);
  /** @type import("@ndn/keychain").EcCurve */
  const curve = req.body.curve;
  const [privateKey, publicKey] = await EcPrivateKey.generate(name, curve, keyChain);
  const cert = await Certificate.selfSign({ privateKey, publicKey });
  await keyChain.insertCert(cert);
  message(`${AltUri.ofName(cert.name)} generated.`,
    { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @type {import("express").Handler} */
async function reqForm(req, res) {
  const name = nameFromHex(req.query.name);
  let days = Number.parseInt(req.query.days, 10);
  if (!days) {
    days = 30;
  }

  const [privateKey, publicKey] = await keyChain.getKeyPair(name);
  const validity = ValidityPeriod.daysFromNow(days);
  const cert = await Certificate.selfSign({ privateKey, publicKey, validity });
  const { subjectName } = cert.certName;
  template("keychain-req", { name, days, cert, subjectName })(req, res);
}

/** @type {import("express").Handler} */
async function insertCert(req, res) {
  const cert = certFromBase64(req.body.cert);
  await keyChain.insertCert(cert);
  message(`Certificate ${AltUri.ofName(cert.name)} installed.`, { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @type {import("express").Handler} */
async function importNdnsec(req, res) {
  const ndnsecKeychain = new NdnsecKeyChain();
  await ndnsecKeychain.copyTo(keyChain);
  message("Keys and certificates have been imported.", { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @param {import("express").Express} app */
export function register(app) {
  app.get("/keychain-list.html", handleError(list));
  app.post("/keychain-delete-key.cgi", handleError(deleteKey));
  app.post("/keychain-delete-cert.cgi", handleError(deleteCert));
  app.post("/keychain-selfsign.cgi", handleError(selfSign));

  app.get("/keychain-gen.html", template("keychain-gen"));
  app.post("/keychain-gen.cgi", handleError(genKey));

  app.get("/keychain-req.html", handleError(reqForm));
  app.post("/keychain-insert-cert.cgi", handleError(insertCert));

  app.get("/keychain-import-ndnsec.html", template("keychain-import-ndnsec"));
  app.post("/keychain-import-ndnsec.cgi", handleError(importNdnsec));
}
