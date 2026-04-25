const { AndroidConfig, withAndroidColors, withAndroidColorsNight, withAndroidStyles } = require('@expo/config-plugins');

const APP_BACKGROUND_LIGHT = '#f0f4ff';
const APP_BACKGROUND_DARK = '#0b1120';
const APP_THEME_GROUP = AndroidConfig.Styles.getAppThemeGroup();

function withAppThemeColors(config) {
  return withAndroidColors(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
      name: 'app_background',
      value: APP_BACKGROUND_LIGHT,
    });
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
      name: 'colorPrimaryDark',
      value: APP_BACKGROUND_LIGHT,
    });
    return mod;
  });
}

function withAppThemeNightColors(config) {
  return withAndroidColorsNight(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
      name: 'app_background',
      value: APP_BACKGROUND_DARK,
    });
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
      name: 'colorPrimaryDark',
      value: APP_BACKGROUND_DARK,
    });
    return mod;
  });
}

function withAppThemeStyles(config) {
  return withAndroidStyles(config, (mod) => {
    let xml = mod.modResults;

    xml = AndroidConfig.Styles.assignStylesValue(xml, {
      add: true,
      parent: APP_THEME_GROUP,
      name: 'android:windowBackground',
      value: '@color/app_background',
    });
    xml = AndroidConfig.Styles.assignStylesValue(xml, {
      add: true,
      parent: APP_THEME_GROUP,
      name: 'android:statusBarColor',
      value: '@color/app_background',
    });
    xml = AndroidConfig.Styles.assignStylesValue(xml, {
      add: true,
      parent: APP_THEME_GROUP,
      name: 'android:navigationBarColor',
      value: '@color/app_background',
    });

    mod.modResults = xml;
    return mod;
  });
}

module.exports = function withAndroidWindowTheme(config) {
  config = withAppThemeColors(config);
  config = withAppThemeNightColors(config);
  config = withAppThemeStyles(config);
  return config;
};
