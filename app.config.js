/* global __dirname */
const { existsSync } = require('node:fs');
const { join } = require('node:path');

module.exports = ({ config }) => {
  const googleServicesFile = './google-services.json';
  if (config.android?.googleServicesFile || !existsSync(join(__dirname, googleServicesFile))) {
    return config;
  }
  return { ...config, android: { ...config.android, googleServicesFile } };
};
