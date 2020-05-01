import { Certificate, EcPrivateKey, ValidityPeriod } from "@ndn/keychain";
import { AltUri } from "@ndn/naming-convention2";
import { NdnsecKeyChain } from "@ndn/ndnsec";
import { Data, Name } from "@ndn/packet";
import { Decoder, Encoder, fromHex } from "@ndn/tlv";

import { keyChain } from "./env.js";
import { message, template } from "./helper.js";
import { require } from "./require.js";
/** @type import("fast-chunk-string") */
const fastChunkString = require("fast-chunk-string");

const KEYCHAIN_LIST_URI = "keychain-list.html";

/** @type {import("express").Handler} */
async function list(req, res) {
  res.render("keychain-list", {
    keyNames: await keyChain.listKeys(),
    certNames: await keyChain.listCerts(),
  });
}

/** @type {import("express").Handler} */
async function deleteKey(req, res) {
  const name = new Name(fromHex(req.body.name));
  await keyChain.deleteKey(name);
  message(`Key ${AltUri.ofName(name)} deleted.`,
    { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @type {import("express").Handler} */
async function deleteCert(req, res) {
  const name = new Name(fromHex(req.body.name));
  await keyChain.deleteCert(name);
  message(`Certificate ${AltUri.ofName(name)} deleted.`,
    { next: KEYCHAIN_LIST_URI })(req, res);
}

/** @type {import("express").Handler} */
async function selfSign(req, res) {
  const name = new Name(fromHex(req.body.name));
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
  const name = new Name(fromHex(req.query.name));
  let days = Number.parseInt(req.query.days, 10);
  if (!days) {
    days = 30;
  }

  const [privateKey, publicKey] = await keyChain.getKeyPair(name);
  const validity = ValidityPeriod.daysFromNow(days);
  const cert = await Certificate.selfSign({ privateKey, publicKey, validity });
  const certreq = fastChunkString(Buffer.from(Encoder.encode(cert.data)).toString("base64"),
    { size: 64 }).join("\n");

  const { subjectName } = cert.certName;
  template("keychain-req", { name, days, cert, certreq, subjectName })(req, res);
}

/** @type {import("express").Handler} */
async function insertCert(req, res) {
  /** @type Certificate */
  let cert;
  try {
    const buffer = Buffer.from(req.body.cert, "base64");
    const data = new Decoder(buffer).decode(Data);
    cert = new Certificate(data);
  } catch {
    message("Invalid certificate.", { next: "back" })(req, res);
    return;
  }
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
  app.get("/keychain-list.html", list);
  app.post("/keychain-delete-key.cgi", deleteKey);
  app.post("/keychain-delete-cert.cgi", deleteCert);
  app.post("/keychain-selfsign.cgi", selfSign);

  app.get("/keychain-gen.html", template("keychain-gen"));
  app.post("/keychain-gen.cgi", genKey);

  app.get("/keychain-req.html", reqForm);
  app.post("/keychain-insert-cert.cgi", insertCert);

  app.get("/keychain-import-ndnsec.html", template("keychain-import-ndnsec"));
  app.post("/keychain-import-ndnsec.cgi", importNdnsec);
}
