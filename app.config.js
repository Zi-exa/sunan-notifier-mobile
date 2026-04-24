const appJson = require('./app.json');

const PREVIEW_PROFILES = new Set(['preview', 'development']);
const PRODUCTION_ANDROID_PACKAGE = 'id.umk.sunannotifier';
const PREVIEW_ANDROID_PACKAGE = 'id.umk.sunannotifier.preview';

module.exports = () => {
  const buildProfile = process.env.EAS_BUILD_PROFILE ?? '';
  const isPreviewProfile = PREVIEW_PROFILES.has(buildProfile);
  const expo = appJson.expo;

  return {
    ...expo,
    name: isPreviewProfile ? 'SUNAN Notifier Preview' : expo.name,
    ios: {
      ...expo.ios,
      bundleIdentifier: isPreviewProfile
        ? PREVIEW_ANDROID_PACKAGE
        : PRODUCTION_ANDROID_PACKAGE,
    },
    android: {
      ...expo.android,
      package: isPreviewProfile ? PREVIEW_ANDROID_PACKAGE : PRODUCTION_ANDROID_PACKAGE,
    },
  };
};
