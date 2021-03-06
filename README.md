# NDNts Personal CA

**NDNts Personal CA** creates an NDN Certificate Authority for all your end hosts.
It is great for:

* A power user who has multiple end hosts.
* A webapp developer that wants to provide NDN certificates to website visitors.

## Instructions

System requirements:

* Node.js 16.x
* Windows 10, Debian 10, or Ubuntu 20.04

Setup steps:

1. Clone the repository.
2. Execute `npm install`, or `pnpm install` if you have PNPM.
3. Run `npm start`, or `pm2 start ecosystem.config.js` for production deployment with PM2.
4. Visit `http://localhost:8722/` in a web browser.
5. If using PM2, you have to manually restart the service with `pm2 restart ecosystem.config.js` after changing CA profile.

To obtain an NDN testbed certificate and start issuing sub-certificates:

1. Open [NDNCERT-legacy](https://ndncert.named-data.net/), enter your email and select "guest certificate".
2. When prompted to run `ndnsec-keygen`, generate a key on Personal CA "manage CA keychain" page instead.
   Then, click "request cert" and copy-paste the certificate request into NDNCERT-legacy.
3. When you get email to install issued certificate, copy-paste the email into the "request cert" page.
4. Go to Personal CA "create new CA profile" page, and select the testbed certificate.

You can then obtain sub-certificates from this Personal CA using one of these methods:

* use a NDNCERT v0.3 client
* use "submit a certificate request" page

### Try on Anyfiddle

You can try NDNts Personal CA on [Anyfiddle](https://anyfiddle.com), without local installation.

1. Create a project from *NodeJS* template (Node 14.x).
2. Download the code: `git init && git fetch https://github.com/yoursunny/NDNts-CA.git && git checkout FETCH_HEAD`
3. Install dependencies: `npm install`
4. Edit file `anyfiddle.json`:

    ```json
    {
       "defaultCommand": "npm start",
       "port": 8722
    }
    ```

5. Click "▶️Run" button to start the project, and visit the provided web address.

Note that Anyfiddle is unsuitable for long-term installation, because anyone who knows your project name will be able to access your CA, and the NDNCERT server is available only if you have the editor open.

## Technical Information

![NDNts logo](public/logo.svg)

NDNts Personal CA is built with:

* [NDNts](https://yoursunny.com/p/NDNts/), Named Data Networking libraries for the modern web.
* [Fastify](https://www.fastify.io/) web framework.

This project shows how to write a Node.js application with NDNts libraries.
It also demonstrates these NDNts capabilities:

* Key generation and certificate management from `@ndn/keychain` package.
* NDNCERT v0.3 protocol implementation from `@ndn/ndncert` package.
* Embedded repo from `@ndn/repo` package.
