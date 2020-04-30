import { AltUri } from "@ndn/naming-convention2";

/** @param {import("express").Express} app */
export function registerViewHelpers(app) {
  app.locals.helper = {
    altUri(name) { return AltUri.ofName(name); },
  };
}

/**
 * Render a template.
 * @param {string} view
 * @param {object} options
 * @return {import("express").Handler}
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
 * @return {import("express").Handler}
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
