import fs from "node:fs/promises";

import { closeUplinks, openKeyChain, openUplinks } from "@ndn/cli-common";
import { C as ndncertC, CaProfile, Server, ServerNopChallenge, ServerPinChallenge } from "@ndn/ndncert";
import { Data, FwHint } from "@ndn/packet";
import { DataStore, PrefixRegStatic, RepoProducer } from "@ndn/repo";
import { Decoder } from "@ndn/tlv";
import sadamsEnvironment from "@sadams/environment";
import dotenv from "dotenv";
import * as envfile from "envfile";
import leveldown from "leveldown";

const { makeEnv, parsers } = sadamsEnvironment;

dotenv.config();

export const env = makeEnv({
  host: {
    envVarName: "CA_HTTP_HOST",
    parser: parsers.ipAddress,
    required: false,
    defaultValue: "127.0.0.1",
  },
  port: {
    envVarName: "CA_HTTP_PORT",
    parser: parsers.port,
    required: false,
    defaultValue: 8722,
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
  const fenv = envfile.parse(await fs.readFile(".env", { encoding: "utf8" }));
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

  /** @type {import("@ndn/packet").Signer|undefined} */
  let signer;
  try {
    const profileData = new Decoder(await fs.readFile(env.profile)).decode(Data);
    profile = await CaProfile.fromData(profileData);
    signer = await keyChain.getSigner(profile.cert.name);
  } catch {
    try {
      await fs.unlink(env.profile);
    } catch {}
    return;
  }

  await repo.insert(profile.cert.data);
  const repoPrefix = profile.prefix.append(ndncertC.CA);
  repoProducer = RepoProducer.create(repo, {
    reg: PrefixRegStatic(repoPrefix, profile.cert.name),
  });

  server = Server.create({
    repo,
    repoFwHint: new FwHint(repoPrefix),
    profile,
    signer,
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
      challenge.addEventListener("newpin", ({ requestId, pin }) => {
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
  repoProducer?.[Symbol.dispose]();
  repo[Symbol.dispose]();
  closeUplinks();
}

process.once("SIGUSR2", () => {
  cleanup();
  setTimeout(() => process.exit(), 500);
});
process.once("beforeExit", cleanup);
