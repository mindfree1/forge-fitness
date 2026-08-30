const { ensureForgeIcons } = require('./scripts/generate-forge-icons');

ensureForgeIcons(__dirname);

module.exports = {
  expo: {
    name: 'Forge',
    slug: 'forge',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'forge',
    userInterfaceStyle: 'dark',

    icon: './assets/forge-icon.png',

    android: {
      package: 'com.mindfree1.forge',
      icon: './assets/forge-icon.png',
      adaptiveIcon: {
        foregroundImage: './assets/forge-adaptive-icon.png',
        monochromeImage: './assets/forge-adaptive-icon.png',
        backgroundColor: '#10110F',
      },
    },

    plugins: [
      'expo-router',
      'expo-sqlite',
      'expo-font',
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      router: {},
      eas: {
        projectId: '6b6d576a-96c0-4789-88a8-e767485d9a64',
      },
    },

    owner: 'mindfree1',
  },
};