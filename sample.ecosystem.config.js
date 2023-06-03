/* eslint-disable camelcase */

module.exports = {
  apps: [
    {
      name: "NDNts-CA",
      script: "./src/main.js",
      env: {
        NODE_ENV: "production",
      },
      cron_restart: "24 16 * * *",
    },
  ],
};
