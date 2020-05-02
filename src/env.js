import { closeUplinks, openKeyChain, openUplinks } from "@ndn/cli-common";
import { Endpoint } from "@ndn/endpoint";
import { Certificate } from "@ndn/keychain";
import { CaProfile, Server, ServerNopChallenge } from "@ndn/ndncert";
import { Data, Interest } from "@ndn/packet";
import { DataStore, RepoProducer } from "@ndn/repo";
import { Decoder } from "@ndn/tlv";
import dotenv from "dotenv";
import leveldown from "leveldown";

import { require } from "./require.js";
/** @type import("@strattadb/environment") */
const { makeEnv, parsers } = require("@strattadb/environment");
/** @type import("envfile") */
const envfile = require("envfile");
/** @type import("graceful-fs") */
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
});

/**
 * Modify .env and trigger restart.
 * @param {Record<string, string>} changes
 */
export async function modifyEnv(changes) {
  /** @type Record<string, string> */
  const fenv = envfile.parseSync(await fs.readFile(".env", { encoding: "utf-8" }));
  Object.assign(fenv, changes);
  await fs.writeFile(".env", envfile.stringifySync(fenv));
}

export const keyChain = openKeyChain();

/** @type DataStore|undefined */
export let repo; // eslint-disable-line import/no-mutable-exports

/** @type RepoProducer */
let repoProducer;

/** @type CaProfile|undefined */
export let profile; // eslint-disable-line import/no-mutable-exports

/** @type Server|undefined */
let server;

/** @type import("@ndn/endpoint").Producer[]|undefined */
let certProducers;

async function publishCerts() {
  const endpoint = new Endpoint({ announcement: false });
  certProducers = [];
  for (let cert = profile.cert; !cert.certName.subjectName.isPrefixOf(cert.data.sigInfo.keyLocator);) {
    const { data } = cert;
    certProducers.push(endpoint.produce(cert.name.getPrefix(-2), async () => data));
    try {
      const data = await endpoint.consume(new Interest(cert.data.sigInfo.keyLocator, Interest.CanBePrefix));
      cert = new Certificate(data);
    } catch { break; }
  }
}

export async function initialize() {
  await openUplinks();

  /** @type import("@ndn/keychain").PrivateKey|undefined */
  let key;
  try {
    const profileData = new Decoder(await fs.readFile(env.profile)).decode(Data);
    profile = await CaProfile.fromData(profileData);
    key = await keyChain.getPrivateKey(profile.cert.certName.toKeyName().toName());
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
    challenges: [new ServerNopChallenge()],
    issuerId: "NDNts-Personal-CA",
  });
}

function cleanup() {
  if (certProducers) {
    certProducers.map((p) => p.close());
  }
  if (server) {
    server.close();
  }
  repoProducer.close();
  repo.close();
  closeUplinks();
}

process.once("SIGUSR2", () => {
  cleanup();
  setTimeout(() => process.exit(), 500);
});
process.once("beforeExit", cleanup);
