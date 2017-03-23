const config = {
  consumer_key: null,
  consumer_secret: null,
  access_token: null,
  access_token_secret: null,
  redis_port: null,
  redis_url: null,
  bot_name: null,
  spreadsheet_key: null
};

// Load in user settings from userconfig.json
try {
  Object.assign(config, require("./userconfig"));
} catch (e) {}

// This allows us to override config parameters with environment variables.
for (let key of Object.keys(config)) {
  config[key] = process.env[key.toUpperCase()] || config[key];
}

module.exports = config;

if (require.main === module) {
  console.log(JSON.stringify(config, null, 2));
}