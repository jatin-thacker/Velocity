// Loads .env.sit (IST) or .env.uat depending on ENV
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const ENV = (process.env.ENV || "uat").toLowerCase(); // default UAT
const envFile = path.resolve(process.cwd(), `.env.${ENV}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  console.warn(`⚠️  ${envFile} not found; using process env only.`);
}

const cfg = {
  env: ENV,
  baseUrl: process.env.BASE_URL || "",
  userEmail: process.env.USER_EMAIL || "",
  userPassword: process.env.USER_PASSWORD || ""
};

module.exports = { cfg };
