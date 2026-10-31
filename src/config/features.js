export const FEATURES = {
  // The parent area can change this at runtime. The default stays paused.
  rewards: false,
  pets: true,
};

export function applyFeatureSettings(settings = {}) {
  FEATURES.rewards = settings.rewardsEnabled === true;
  return FEATURES;
}
