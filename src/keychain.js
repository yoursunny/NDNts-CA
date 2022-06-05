import { Certificate, CertNaming, ECDSA, generateSigningKey, ValidityPeriod } from "@ndn/keychain";
import { AltUri } from "@ndn/naming-convention2";
import { ClientEmailChallenge, importClientConf, requestCertificate } from "@ndn/ndncert";
import { NdnsecKeyChain } from "@ndn/ndnsec";
import { Name } from "@ndn/packet";
import got from "got";
import gracefulfs from "graceful-fs";

const { promises: fs } = gracefulfs;

import { keyChain } from "./env.js";
import { certFromBase64, message, nameFromHex, template } from "./helper.js";

const nextList = { next: "keychain-list.html" };

/** @type {import("fastify").RouteHandler} */
async function list(req, reply) {
  return template("keychain-list", {
    keyNames: await keyChain.listKeys(),
    certNames: await keyChain.listCerts(),
  })(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: { name: string } }>} */
async function deleteKey(req, reply) {
  const name = nameFromHex(req.body.name);
  await keyChain.deleteKey(name);
  return message(`Key ${AltUri.ofName(name)} deleted.`, nextList)(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: { name: string } }>} */
async function deleteCert(req, reply) {
  const name = nameFromHex(req.body.name);
  await keyChain.deleteCert(name);
  return message(`Certificate ${AltUri.ofName(name)} deleted.`, nextList)(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: { name: string } }>} */
async function selfSign(req, reply) {
  const name = nameFromHex(req.body.name);
  const { signer, publicKey } = await keyChain.getKeyPair(name);
  const cert = await Certificate.selfSign({ privateKey: signer, publicKey });
  await keyChain.insertCert(cert);
  return message(`Self-signed certificate ${AltUri.ofName(cert.name)} created.`, nextList)(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: { name: string, curve: import("@ndn/keychain").EcCurve } }>} */
async function genKey(req, reply) {
  const name = new Name(req.body.name);
  const curve = req.body.curve;
  const [privateKey] = await generateSigningKey(keyChain, name, ECDSA, { curve });
  return message(`Key ${AltUri.ofName(privateKey.name)} generated.`, nextList)(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Querystring: Record<"name"|"days", string> }>} */
async function reqForm(req, reply) {
  const name = nameFromHex(String(req.query.name));
  const days = Number.parseInt(String(req.query.days), 10) || 30;

  const { signer, publicKey } = await keyChain.getKeyPair(name);
  const validity = ValidityPeriod.daysFromNow(days);
  const cert = await Certificate.selfSign({
    privateKey: signer,
    publicKey,
    validity,
  });
  return template("keychain-req", {
    name,
    days,
    cert,
    subjectName: CertNaming.toSubjectName(cert.name),
    isNdnTestbed: new Name("/ndn").isPrefixOf(cert.name),
  })(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: { cert: string } }>} */
async function insertCert(req, reply) {
  const cert = certFromBase64(req.body.cert);
  await keyChain.insertCert(cert);
  return message(`Certificate ${AltUri.ofName(cert.name)} installed.`, nextList)(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: { email: string } }>} */
async function downloadNdncertLegacy(req, reply) {
  const email = String(req.body.email);
  const m = email.match(/(https:\/\/ndncert\.named-data\.net\/cert\/get\/[^"]+)"?/);
  if (!m) {
    throw new Error("Certificate name not found in email.");
  }
  const response = await got(m[1]);
  const cert = certFromBase64(response.body);
  await keyChain.insertCert(cert);
  return message(`Certificate ${AltUri.ofName(cert.name)} installed.`, nextList)(req, reply);
}

/**
 * @type {{
 *  abort: AbortController;
 *  ctx?: import("@ndn/ndncert").ClientChallengeContext;
 *  enter?: (pin: string) => void;
 *  cert?: Certificate;
 *  fail?: string;
 * } | undefined}
 */
let testbedClientContext;

/** @type {import("fastify").RouteHandler<{ Body: { name: string, email: string } }>} */
async function testbedClientBegin(req, reply) {
  const name = nameFromHex(String(req.body.name));
  const { signer, verifier } = await keyChain.getKeyPair(name);
  const email = String(req.body.email);

  const clientConf = await fs.readFile(new URL("testbed-root-clientconf.json", import.meta.url), { encoding: "utf8" });
  const profile = await importClientConf(JSON.parse(clientConf));
  testbedClientContext?.abort.abort();
  testbedClientContext = {
    abort: new AbortController(),
  };
  (async () => {
    try {
      testbedClientContext.cert = await requestCertificate({
        profile,
        privateKey: signer,
        publicKey: verifier,
        challenges: [
          new ClientEmailChallenge(email, (ctx) => new Promise((resolve, reject) => {
            testbedClientContext.ctx = ctx;
            testbedClientContext.enter = resolve;
            testbedClientContext.abort.signal.addEventListener("abort", reject);
          })),
        ],
      });
      await keyChain.insertCert(testbedClientContext.cert);
    } catch (err) {
      if (testbedClientContext) {
        testbedClientContext.fail = err.toString();
      }
    }
  })();
  return reply.redirect("keychain-testbed-client-status.html");
}

/** @type {import("fastify").RouteHandler} */
async function testbedClientStatus(req, reply) {
  if (!testbedClientContext) {
    return message("NDNCERT client session not found.", nextList)(req, reply);
  }
  const { ctx, cert, fail } = testbedClientContext;
  if (fail) {
    testbedClientContext = undefined;
    return message(`NDNCERT client failed: ${fail}`, nextList)(req, reply);
  }
  if (cert) {
    testbedClientContext = undefined;
    return message(`Certificate ${AltUri.ofName(cert.name)} installed.`, nextList)(req, reply);
  }
  if (!ctx) {
    return message("NDNCERT client running, please wait.", { next: "reload" })(req, reply);
  }
  return template("keychain-testbed-client-pin", {
    requestId: ctx.requestId,
    certRequestName: ctx.certRequestName,
    remainingTries: ctx.remainingTries,
  })(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: { pin: string } }>} */
async function testbedClientEnterPin(req, reply) {
  const pin = String(req.body.pin).trim();
  if (testbedClientContext?.enter) {
    testbedClientContext.enter(pin);
    testbedClientContext.ctx = undefined;
    testbedClientContext.enter = undefined;
  }
  return reply.redirect("keychain-testbed-client-status.html");
}

/** @type {import("fastify").RouteHandler} */
async function importNdnsec(req, reply) {
  const ndnsecKeychain = new NdnsecKeyChain();
  await ndnsecKeychain.copyTo(keyChain);
  return message("Keys and certificates have been imported.", nextList)(req, reply);
}

/** @param {import("fastify").FastifyInstance} fastify */
export function register(fastify) {
  fastify.get("/keychain-list.html", list);
  fastify.post("/keychain-delete-key.cgi", deleteKey);
  fastify.post("/keychain-delete-cert.cgi", deleteCert);
  fastify.post("/keychain-selfsign.cgi", selfSign);

  fastify.get("/keychain-gen.html", template("keychain-gen"));
  fastify.post("/keychain-gen.cgi", genKey);

  fastify.get("/keychain-req.html", reqForm);
  fastify.post("/keychain-insert-cert.cgi", insertCert);
  fastify.post("/keychain-download-ndncert-legacy.cgi", downloadNdncertLegacy);

  fastify.post("/keychain-testbed-client-new.cgi", testbedClientBegin);
  fastify.get("/keychain-testbed-client-status.html", testbedClientStatus);
  fastify.post("/keychain-testbed-client-enter-pin.cgi", testbedClientEnterPin);

  fastify.get("/keychain-import-ndnsec.html", template("keychain-import-ndnsec"));
  fastify.post("/keychain-import-ndnsec.cgi", importNdnsec);
}
