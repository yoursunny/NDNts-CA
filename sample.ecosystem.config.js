/* eslint-disable camelcase */

module.exports = {
  apps: [
    {
      name: "NDNts-CA",
      script: "./server.js",
      env: {
        NODE_ENV: "production",
      },
      cron_restart: "24 16 * * *",
    },
  ],
};
