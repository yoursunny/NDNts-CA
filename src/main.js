import path from "node:path";

import FastifyFormbody from "@fastify/formbody";
import FastifyStatic from "@fastify/static";
import FastifyView from "@fastify/view";
import ejs from "ejs";
import Fastify from "fastify";

import { register as certsRoutes } from "./certs.js";
import { env, initialize, profile, recentPinRequests } from "./env.js";
import { message, template, viewHelpers } from "./helper.js";
import { register as keychainRoutes } from "./keychain.js";
import { register as manualRoutes } from "./manual.js";
import { register as profileRoutes } from "./profile.js";

await initialize();

const fastify = Fastify({
  logger: true,
});
await fastify.register(FastifyFormbody);
await fastify.register(FastifyView, {
  engine: { ejs },
  root: path.resolve(process.cwd(), "views"),
  viewExt: "ejs",
  defaultContext: {
    profile,
    helper: viewHelpers,
  },
});

fastify.get("/", template("frontpage", { challenges: env.challenges, recentPinRequests }));

profileRoutes(fastify);
keychainRoutes(fastify);
manualRoutes(fastify);
certsRoutes(fastify);

fastify.setErrorHandler((err, req, reply) => {
  console.error(err);
  reply.status(400);
  message(err.toString(), { title: "Error", next: "back" })(req, reply);
});
await fastify.register(FastifyStatic, {
  root: path.resolve(process.cwd(), "public"),
});
fastify.listen({
  port: env.port,
  host: env.host,
});
