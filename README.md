# NDNts Personal CA

**NDNts Personal CA** creates an NDN Certificate Authority for all your end hosts.
It is great for:

* A power user who has multiple end hosts.
* A webapp developer that wants to provide NDN certificates to website visitors.

## Instructions

System requirements:

* Node.js 20.x
* Windows 10, Debian 12, or Ubuntu 22.04

Setup steps:

1. Clone the repository.
2. Execute `corepack pnpm install`.
3. Run `corepack pnpm start`, or `pm2 start ecosystem.config.js` for production deployment with PM2.
4. Visit `http://localhost:8722/` in a web browser.
5. If using PM2, you have to manually restart the service with `pm2 restart ecosystem.config.js` after changing CA profile.

To obtain an NDN testbed certificate and start issuing sub-certificates:

1. Go to "keychain" page, create a key within testbed name hierarchy.
2. Click "request cert" to request a certificate from testbed CA.
3. Go to "create new CA profile" page, and select the testbed certificate.

You can then obtain sub-certificates from this Personal CA using one of these methods:

* use a NDNCERT v0.3 client
* use "submit a certificate request" page

## Technical Information

![NDNts logo](public/logo.svg)

NDNts Personal CA is built with:

* [NDNts](https://yoursunny.com/p/NDNts/), Named Data Networking libraries for the modern web.
* [Fastify](https://www.fastify.io) web framework.

This project shows how to write a Node.js application with NDNts libraries.
It also demonstrates these NDNts capabilities:

* Key generation and certificate management from `@ndn/keychain` package.
* NDNCERT v0.3 protocol implementation from `@ndn/ndncert` package.
* Embedded repo from `@ndn/repo` package.
