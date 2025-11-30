module.exports = {
  apps: [
    {
      name: "barbearia",
      script: "npm",
      args: "start",
      cwd: "/var/www/barbearia",
      instances: 1,
      exec_mode: "fork",
      env_file: ".env", // Carregar variáveis do .env
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/barbearia-error.log",
      out_file: "/var/log/pm2/barbearia-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
    },
  ],
};

