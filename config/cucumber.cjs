/** @type {import('@cucumber/cucumber').CliConfig} */
module.exports = {
  default: {
    paths: ["tests/features/**/*.feature"],
    require: [
      "tests/support/world.js",
      "tests/support/**/*.js",
      "tests/steps/**/*.js"
    ],
    format: [
      "progress",
      "message:reports/messages.ndjson",
      "json:reports/cucumber.json"
    ],
    parallel: 1
  }
};
