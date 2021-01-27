import { closeUplinks, openKeyChain, openUplinks } from "@ndn/cli-common";
import { CertNaming } from "@ndn/keychain";
import { CaProfile, Server, ServerNopChallenge, ServerPinChallenge } from "@ndn/ndncert";
import { Data } from "@ndn/packet";
import { DataStore, PrefixRegShorter, RepoProducer } from "@ndn/repo";
import { Decoder } from "@ndn/tlv";
import strattadbEnvironment from "@strattadb/environment";
import dotenv from "dotenv";
import * as envfile from "envfile";
import gracefulfs from "graceful-fs";
import leveldown from "leveldown";

const { promises: fs } = gracefulfs;
const { makeEnv, parsers } = strattadbEnvironment;

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
  const fenv = envfile.parse(await fs.readFile(".env", { encoding: "utf-8" }));
  Object.assign(fenv, changes);
  await fs.writeFile(".env", envfile.stringify(fenv));
}

export const keyChain = openKeyChain();

export const repo = new DataStore(leveldown(env.repo));

/** @type {RepoProducer|undefined} */
let repoProducer;

/** @type {CaProfile|undefined} */
export let profile;

/** @type {Server|undefined} */
let server;

export async function initialize() {
  await openUplinks();

  /** @type {import("@ndn/keychain").NamedSigner|undefined} */
  let key;
  try {
    const profileData = new Decoder(await fs.readFile(env.profile)).decode(Data);
    profile = await CaProfile.fromData(profileData);
    key = await keyChain.getKey(CertNaming.toKeyName(profile.cert.name), "signer");
  } catch {
    try {
      await fs.unlink(env.profile);
    } catch {}
    return;
  }

  await repo.insert(profile.cert.data);
  repoProducer = RepoProducer.create(repo, {
    reg: PrefixRegShorter(2),
  });

  server = Server.create({
    repo,
    profile,
    key,
    challenges: env.challenges.map(makeChallenge),
    issuerId: "NDNts-Personal-CA",
  });
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
  if (server) {
    server.close();
  }
  if (repoProducer) {
    repoProducer.close();
  }
  repo.close();
  closeUplinks();
}

process.once("SIGUSR2", () => {
  cleanup();
  setTimeout(() => process.exit(), 500);
});
process.once("beforeExit", cleanup);
