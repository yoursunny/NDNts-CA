/* eslint-disable import/no-mutable-exports */

import { closeUplinks, openKeyChain, openUplinks } from "@ndn/cli-common";
import { Endpoint } from "@ndn/endpoint";
import { Certificate } from "@ndn/keychain";
import { CaProfile, Server, ServerNopChallenge, ServerPinChallenge } from "@ndn/ndncert";
import { Data, Interest, Name } from "@ndn/packet";
import { DataStore, RepoProducer } from "@ndn/repo";
import { Decoder } from "@ndn/tlv";
import dotenv from "dotenv";
import leveldown from "leveldown";

import { require } from "./require.js";
/** @type {import("@strattadb/environment")} */
const { makeEnv, parsers } = require("@strattadb/environment");
/** @type {import("envfile")} */
const envfile = require("envfile");
/** @type {import("graceful-fs")} */
const { promises: fs } = require("graceful-fs");

dotenv.config();

export const env = makeEnv({
  httpport: {
    envVarName: "CA_HTTP_PORT",
    parser: parsers.port,
    required: true,
  },
  repo: {
    envVarName: "CA_REPO",
    parser: parsers.string,
    required: true,
  },
  profile: {
    envVarName: "CA_PROFILE",
    parser: parsers.string,
    required: true,
  },
  challenges: {
    envVarName: "CA_CHALLENGES",
    parser: parsers.array({ parser: parsers.string }),
    required: false,
    defaultValue: [],
  },
});

/**
 * Modify .env and trigger restart.
 * @param {Record<string, string>} changes
 */
export async function modifyEnv(changes) {
  /** @type {Record<string, string>} */
  const fenv = envfile.parseSync(await fs.readFile(".env", { encoding: "utf-8" }));
  Object.assign(fenv, changes);
  await fs.writeFile(".env", envfile.stringifySync(fenv));
}

export const keyChain = openKeyChain();

/** @type {DataStore|undefined} */
export let repo;

/** @type {RepoProducer|undefined} */
let repoProducer;

/** @type {CaProfile|undefined} */
export let profile;

/** @type {Server|undefined} */
let server;

/** @type {import("@ndn/endpoint").Producer[]|undefined} */
let certProducers;

export async function initialize() {
  await openUplinks();

  /** @type {import("@ndn/keychain").PrivateKey|undefined} */
  let key;
  try {
    const profileData = new Decoder(await fs.readFile(env.profile)).decode(Data);
    profile = await CaProfile.fromData(profileData);
    key = await keyChain.getPrivateKey(profile.cert.certName.key);
  } catch {
    try {
      await fs.unlink(env.profile);
    } catch {}
    return;
  }

  publishCerts().catch(() => undefined);

  repo = new DataStore(leveldown(env.repo));
  repoProducer = RepoProducer.create(repo, {
    reg: RepoProducer.PrefixRegShorter(2),
  });

  server = Server.create({
    repo,
    profile,
    key,
    // eslint-disable-next-line unicorn/no-fn-reference-in-iterator
    challenges: env.challenges.map(makeChallenge),
    issuerId: "NDNts-Personal-CA",
  });
}

async function publishCerts() {
  const testbedRootKeyPrefix = new Name("/ndn/KEY");
  const endpoint = new Endpoint({ announcement: false });
  certProducers = [];
  for (let cert = profile.cert; cert.issuer && !testbedRootKeyPrefix.isPrefixOf(cert.issuer);) {
    const { data } = cert;
    certProducers.push(endpoint.produce(cert.name.getPrefix(-2), async () => data));
    try {
      cert = Certificate.fromData(await endpoint.consume(
        new Interest(cert.issuer, Interest.CanBePrefix)));
    } catch { break; }
  }
}

/** @type {Array<{ requestId: Uint8Array; pin: string }>|undefined} */
export let recentPinRequests;

/**
 * @param {string} id
 * @returns {import("@ndn/ndncert").ServerChallenge}
 */
function makeChallenge(id) {
  switch (id) {
    case "nop": {
      return new ServerNopChallenge();
    }
    case "pin": {
      const challenge = new ServerPinChallenge();
      recentPinRequests = [];
      challenge.on("newpin", (requestId, pin) => {
        recentPinRequests.unshift({ requestId, pin });
        recentPinRequests.splice(20, Infinity);
      });
      return challenge;
    }
  }
  throw new Error(`unknown challenge ${id}`);
}

function cleanup() {
  if (certProducers) {
    certProducers.map((p) => p.close());
  }
  if (server) {
    server.close();
  }
  if (repoProducer) {
    repoProducer.close();
  }
  if (repo) {
    repo.close();
  }
  closeUplinks();
}

process.once("SIGUSR2", () => {
  cleanup();
  setTimeout(() => process.exit(), 500);
});
process.once("beforeExit", cleanup);
