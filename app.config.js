const staticConfig = require('./app.json');
const { ensureForgeIcons } = require('./scripts/generate-forge-icons');

ensureForgeIcons(__dirname);

module.exports = {
  expo: {
    ...staticConfig.expo,
    icon: './assets/forge-icon.png',
    android: {
      ...staticConfig.expo.android,
      icon: './assets/forge-icon.png',
      adaptiveIcon: {
        ...staticConfig.expo.android.adaptiveIcon,
        foregroundImage: './assets/forge-adaptive-icon.png',
        monochromeImage: './assets/forge-adaptive-icon.png',
        backgroundColor: '#10110F',
      },
    },
  },
};
