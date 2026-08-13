require('dotenv').config();
const appJson = require('./app.json');

module.exports = ({ config }) => {
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const apiUrl = isProductionBuild ? 'https://docvia-api.onrender.com' : (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000');
  if (isProductionBuild) {
    const parsed = new URL(apiUrl);
    const privateHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.startsWith('10.') || parsed.hostname.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname);
    if (parsed.protocol !== 'https:' || privateHost) throw new Error('EXPO_PUBLIC_API_URL precisa apontar para uma API pública HTTPS no build de produção.');
  }
  return {
    ...config,
    extra: {
      ...(config.extra || appJson.expo.extra || {}),
      apiUrl,
    },
  };
};
