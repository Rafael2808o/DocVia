require('dotenv').config();
const appJson = require('./app.json');

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || appJson.expo.extra || {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000',
  },
});
