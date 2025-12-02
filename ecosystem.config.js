const fs = require("fs")
const path = require("path")

// Carregar variáveis do .env manualmente
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env")
  const env = {}
  
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf8")
    envFile.split("\n").forEach((line) => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const [key, ...valueParts] = trimmedLine.split("=")
        if (key && valueParts.length > 0) {
          let value = valueParts.join("=")
          // Remover aspas se existirem
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          env[key.trim()] = value.trim()
        }
      }
    })
  }
  
  return env
}

const envVars = loadEnvFile()

module.exports = {
  apps: [
    {
      name: "barbearia",
      script: "npm",
      args: "start",
      cwd: "/var/www/barber",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        ...envVars, // Mesclar todas as variáveis do .env
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

