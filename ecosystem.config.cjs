module.exports = {
  apps: [
    {
      name: "cuoc-thi",
      script: "server/index.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3001,
      },
      max_memory_restart: "500M",
      time: true,
    },
  ],
};