import { Certificate, createVerifier, ValidityPeriod } from "@ndn/keychain";
import { Component } from "@ndn/packet";

import { keyChain, repo } from "./env.js";
import { certFromBase64, nameFromHex, template } from "./helper.js";

/** @type {import("fastify").RouteHandler} */
async function requestForm(req, reply) {
  return template("manual-request", {
    certNames: await keyChain.listCerts(),
  })(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: Record<"certreq"|"issuer"|"validdays", string> }>} */
async function requestSubmit(req, reply) {
  const certreq = certFromBase64(req.body.certreq);
  const publicKey = await createVerifier(certreq);
  const issuer = await keyChain.getCert(nameFromHex(req.body.issuer));
  const issuerPrivateKey = await keyChain.getSigner(issuer.name);
  const validDays = Number.parseInt(req.body.validdays, 10);
  const cert = await Certificate.issue({
    issuerPrivateKey,
    publicKey,
    issuerId: Component.from("NDNts-Personal-CA"),
    validity: ValidityPeriod.daysFromNow(validDays),
  });

  await repo.insert(cert.data);
  reply.redirect(`manual-issued.html?name=${cert.name.valueHex}`);
}

/** @type {import("fastify").RouteHandler<{ Querystring: { name: string } }>} */
async function viewIssued(req, reply) {
  const name = nameFromHex(String(req.query.name));
  const cert = Certificate.fromData(await repo.get(name));
  return template("manual-issued", { cert })(req, reply);
}

/** @param {import("fastify").FastifyInstance} fastify */
export function register(fastify) {
  fastify.get("/manual-request.html", requestForm);
  fastify.post("/manual-submit.cgi", requestSubmit);
  fastify.get("/manual-issued.html", viewIssued);
}
