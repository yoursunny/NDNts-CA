import { Certificate } from "@ndn/keychain";
import { AltUri } from "@ndn/naming-convention2";
import { Data, Name } from "@ndn/packet";
import { Decoder, Encoder, fromHex, toHex } from "@ndn/tlv";
import numd from "numd";

import { require } from "./require.js";
/** @type {import("fast-chunk-string")} */
const fastChunkString = require("fast-chunk-string");

/** @param {import("express").Express} app */
export function registerViewHelpers(app) {
  app.locals.helper = {
    numd,

    /**
     * @param {import("@ndn/packet".Name)} name
     * @returns {string}
     */
    altUri(name) {
      return AltUri.ofName(name);
    },

    toHex,

    /**
     * @param {import("@ndn/packet".Name)} name
     * @returns {string}
     */
    nameHex(name) {
      return toHex(name.value);
    },

    /**
     * @param {Certificate)} cert
     * @returns {string}
     */
    certBase64(cert) {
      const b64 = Buffer.from(Encoder.encode(cert.data)).toString("base64");
      return fastChunkString(b64, { size: 64 }).join("\n");
    },
  };
}

/**
 * Parse hex name from query or body.
 * @param {string} input
 * @returns {Name}
 */
export function nameFromHex(input) {
  return new Name(fromHex(input));
}

/**
 * Parse base64 certificate from query or body.
 * @param {string} input
 * @returns {Certificate}
 */
export function certFromBase64(input) {
  try {
    const buffer = Buffer.from(input, "base64");
    return Certificate.fromData(new Decoder(buffer).decode(Data));
  } catch {
    throw new Error("invalid certificate");
  }
}

/**
 * Wrap an async Express handler with error handling.
 * @param {import("express").Handler} asyncHandler
 * @returns {import("express").Handler}
 */
export function handleError(asyncHandler) {
  return (req, res, next) => {
    Promise.resolve(asyncHandler(req, res, next))
      .catch(next);
  };
}

/**
 * Render a template.
 * @param {string} view
 * @param {object} options
 * @returns {import("express").Handler}
 */
export function template(view, options) {
  return (req, res) => {
    res.render(view, options);
  };
}

const MESSAGE_NEXT = {
  home: "location = './'",
  back: "history.back()",
};

/**
 * Display message and optionally redirect back to frontpage.
 * @param {string} message
 * @param {object} opts
 * @param {string} opts.title
 * @param {"home"|"back"|string} opts.next
 * @returns {import("express").Handler}
 */
export function message(message, opts = {}) {
  const {
    title = "Message",
    next = "home",
  } = opts;
  let nextAction = MESSAGE_NEXT[next];
  if (!nextAction) {
    nextAction = `location = decodeURI('${encodeURI(next)}')`;
  }
  return (req, res) => {
    res.render("message", { message, title, nextAction });
  };
}
