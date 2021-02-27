import { Certificate } from "@ndn/keychain";
import numd from "numd";

import { repo } from "./env.js";
import { message, nameFromHex, template } from "./helper.js";

const nextList = { next: "certs-list.html" };

/** @type {import("fastify").RouteHandler} */
async function list(req, reply) {
  /** @type {Certificate[]} */
  const certs = [];
  for await (const data of repo.listData()) {
    certs.push(Certificate.fromData(data));
  }
  return template("certs-list", { certs })(req, reply);
}

/** @type {import("fastify").RouteHandler<{ Body: Record<"act"|"name", string> }>} */
async function act(req, reply) {
  const act = req.body.act;
  /** @type {import("@ndn/packet").Name[]} */
  let names = [];
  if (Array.isArray(req.body.name)) {
    names = req.body.name.map(nameFromHex);
  } else if (typeof req.body.name === "string") {
    names.push(nameFromHex(req.body.name));
  }

  switch (act) {
    case "delete": {
      await repo.delete(...names);
      return message(`${numd(names.length, "certificate", "certificates")} deleted.`, nextList)(req, reply);
    }
    default:
      throw new Error("unknown action");
  }
}

/** @param {import("fastify").FastifyInstance} fastify */
export function register(fastify) {
  fastify.get("/certs-list.html", list);
  fastify.post("/certs-act.cgi", act);
}
