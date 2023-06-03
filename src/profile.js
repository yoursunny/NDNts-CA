import fs from "node:fs/promises";

import { CertNaming } from "@ndn/keychain";
import { CaProfile } from "@ndn/ndncert";
import { Encoder } from "@ndn/tlv";

import { env, keyChain, modifyEnv, profile } from "./env.js";
import { message, nameFromHex, template } from "./helper.js";

/** @type {import("fastify").RouteHandler} */
async function download(req, reply) {
  if (!profile) {
    return reply.status(404);
  }
  reply.header("Content-Type", "application/octet-stream");
  reply.send(Buffer.from(Encoder.encode(profile.data)));
}

/** @type {import("fastify").RouteHandler} */
function listIntermediates(req, reply) {
  if (!profile) {
    return reply.status(404);
  }
  return reply.redirect(`keychain-intermediates.txt?name=${profile.cert.name.valueHex}`);
}

/** @type {import("fastify").RouteHandler} */
async function newForm(req, reply) {
  return template("profile-new", {
    certNames: await keyChain.listCerts(),
  })(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: Record<"cert"|"info"|"validdays"|"challenge-nop"|"challenge-pin", string> }>} */
async function newSubmit(req, reply) {
  const challenges = ["nop", "pin"].filter((challenge) => req.body[`challenge-${challenge}`] === "1");
  if (challenges.length === 0) {
    return message("At least one challenge is required.", { next: "back" })(req, reply);
  }

  const cert = await keyChain.getCert(nameFromHex(req.body.cert));
  const signer = await keyChain.getSigner(cert.name);
  const info = String(req.body.info).trim();
  const maxValidityPeriod = 86400000 * Number.parseInt(req.body.validdays, 10);
  const profile = await CaProfile.build({
    prefix: CertNaming.toSubjectName(cert.name),
    info,
    probeKeys: [],
    maxValidityPeriod,
    cert,
    signer,
  });
  await fs.writeFile(env.profile, Encoder.encode(profile.data));

  setTimeout(async () => {
    const certName = cert.name.toString();
    await modifyEnv({
      NDNTS_KEY: certName,
      NDNTS_NFDREGKEY: certName,
      CA_KEY: certName,
      CA_CHALLENGES: challenges.join(","),
    });
  }, 1000);

  return message("Profile saved, restarting server.")(req, reply);
}

/** @param {import("fastify").FastifyInstance} fastify */
export function register(fastify) {
  fastify.get("/profile.html", template("profile-view"));
  fastify.get("/profile.data", download);
  fastify.get("/profile-intermediates.txt", listIntermediates);

  fastify.get("/profile-new.html", newForm);
  fastify.post("/profile-new.cgi", newSubmit);
}
