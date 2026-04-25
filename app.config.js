const appJson = require('./app.json');

const PREVIEW_PROFILES = new Set(['preview', 'development']);
const PRODUCTION_APP_ID = 'id.umk.sunannotifier';
const PREVIEW_APP_ID = 'id.umk.sunannotifier.preview';

module.exports = () => {
  const buildProfile = process.env.EAS_BUILD_PROFILE ?? '';
  const isPreviewProfile = PREVIEW_PROFILES.has(buildProfile);
  const expo = appJson.expo;

  return {
    ...expo,
    name: expo.name,
    ios: {
      ...expo.ios,
      bundleIdentifier: isPreviewProfile
        ? PREVIEW_APP_ID
        : PRODUCTION_APP_ID,
    },
    android: {
      ...expo.android,
      package: isPreviewProfile ? PREVIEW_APP_ID : PRODUCTION_APP_ID,
    },
  };
};
