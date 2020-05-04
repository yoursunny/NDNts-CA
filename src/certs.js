import { Certificate } from "@ndn/keychain";
import numd from "numd";

import { repo } from "./env.js";
import { handleError, message, nameFromHex, template } from "./helper.js";

const nextList = { next: "certs-list.html" };

/** @type {import("express").Handler} */
async function list(req, res) {
  /** @type {Certificate[]} */
  const certs = [];
  for await (const data of repo.list()) {
    certs.push(Certificate.fromData(data));
  }
  template("certs-list", { certs })(req, res);
}

/** @type {import("express").Handler} */
async function act(req, res) {
  const act = req.body.act;
  /** @type {import("@ndn/packet").Name[]} */
  let names = [];
  if (Array.isArray(req.body.name)) {
    names = req.body.name.map(nameFromHex); // eslint-disable-line unicorn/no-fn-reference-in-iterator
  } else if (typeof req.body.name === "string") {
    names.push(nameFromHex(req.body.name));
  }

  switch (act) {
    case "delete": {
      await repo.delete(...names);
      message(`${numd(names.length, "certificate", "certificates")} deleted.`, nextList)(req, res);
      break;
    }
    default:
      throw new Error("unknown action");
  }
}

/** @param {import("express").Express} app */
export function register(app) {
  app.get("/certs-list.html", handleError(list));
  app.post("/certs-act.cgi", handleError(act));
}
