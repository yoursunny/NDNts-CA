module.exports = {
  apps: [
    {
      name: "NDNts-CA",
      script: "./server.js",
      env: {
        NODE_ENV: "production",
      },
      // eslint-disable-next-line camelcase
      cron_restart: "24 16 * * *",
    },
  ],
};
