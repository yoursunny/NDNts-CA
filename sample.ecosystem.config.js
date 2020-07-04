module.exports = {
  apps: [
    {
      name: "NDNts-CA",
      script: "./server.js",
      env: {
        NODE_ENV: "production",
      },
      watch: [".env"],
    },
  ],
};
