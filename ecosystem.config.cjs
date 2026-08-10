module.exports = {
  apps: [
    {
      name: "Telas-serigrafia",
      cwd: __dirname,
      script: "./dist/server.js",

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      time: true,
      max_memory_restart: "1G"
    }
  ]
};
