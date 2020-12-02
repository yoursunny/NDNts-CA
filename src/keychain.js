import { Certificate, CertNaming, ECDSA, generateSigningKey, ValidityPeriod } from "@ndn/keychain";
import { AltUri } from "@ndn/naming-convention2";
import { NdnsecKeyChain } from "@ndn/ndnsec";
import { Name } from "@ndn/packet";
import got from "got";

import { keyChain } from "./env.js";
import { certFromBase64, handleError, message, nameFromHex, template } from "./helper.js";

const nextList = { next: "keychain-list.html" };

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
  message(`Key ${AltUri.ofName(name)} deleted.`, nextList)(req, res);
}

/** @type {import("express").Handler} */
async function deleteCert(req, res) {
  const name = nameFromHex(req.body.name);
  await keyChain.deleteCert(name);
  message(`Certificate ${AltUri.ofName(name)} deleted.`, nextList)(req, res);
}

/** @type {import("express").Handler} */
async function selfSign(req, res) {
  const name = nameFromHex(req.body.name);
  const { signer, publicKey } = await keyChain.getKeyPair(name);
  const cert = await Certificate.selfSign({ privateKey: signer, publicKey });
  await keyChain.insertCert(cert);
  message(`Self-signed certificate ${AltUri.ofName(cert.name)} created.`, nextList)(req, res);
}

/** @type {import("express").Handler} */
async function genKey(req, res) {
  const name = new Name(req.body.name);
  /** @type {import("@ndn/keychain").EcCurve} */
  const curve = req.body.curve;
  const [privateKey] = await generateSigningKey(keyChain, name, ECDSA, { curve });
  message(`Key ${AltUri.ofName(privateKey.name)} generated.`, nextList)(req, res);
}

/** @type {import("express").Handler} */
async function reqForm(req, res) {
  const name = nameFromHex(String(req.query.name));
  let days = Number.parseInt(String(req.query.days), 10);
  if (!days) {
    days = 30;
  }

  const { signer, publicKey } = await keyChain.getKeyPair(name);
  const validity = ValidityPeriod.daysFromNow(days);
  const cert = await Certificate.selfSign({
    privateKey: signer,
    publicKey,
    validity,
  });
  const subjectName = CertNaming.toSubjectName(cert.name);
  template("keychain-req", { name, days, cert, subjectName })(req, res);
}

/** @type {import("express").Handler} */
async function insertCert(req, res) {
  const cert = certFromBase64(req.body.cert);
  await keyChain.insertCert(cert);
  message(`Certificate ${AltUri.ofName(cert.name)} installed.`, nextList)(req, res);
}

/** @type {import("express").Handler} */
async function downloadNdncertLegacy(req, res) {
  const email = String(req.body.email);
  const m = email.match(/(https:\/\/ndncert\.named-data\.net\/cert\/get\/[^"]+)"?/);
  if (!m) {
    throw new Error("Certificate name not found in email.");
  }
  const response = await got(m[1]);
  const cert = certFromBase64(response.body);
  await keyChain.insertCert(cert);
  message(`Certificate ${AltUri.ofName(cert.name)} installed.`, nextList)(req, res);
}

/** @type {import("express").Handler} */
async function importNdnsec(req, res) {
  const ndnsecKeychain = new NdnsecKeyChain();
  await ndnsecKeychain.copyTo(keyChain);
  message("Keys and certificates have been imported.", nextList)(req, res);
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
  app.post("/keychain-download-ndncert-legacy.cgi", handleError(downloadNdncertLegacy));

  app.get("/keychain-import-ndnsec.html", template("keychain-import-ndnsec"));
  app.post("/keychain-import-ndnsec.cgi", handleError(importNdnsec));
}
