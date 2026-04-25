const MIN_SAFE_BOTTOM = 12;
const FLOATING_DOCK_CLEARANCE = 100;
const FLOATING_FILTER_BUTTON_SIZE = 58;
const FLOATING_FILTER_BOTTOM_OFFSET = 84;
const FLOATING_FILTER_CLEARANCE = FLOATING_FILTER_BOTTOM_OFFSET + FLOATING_FILTER_BUTTON_SIZE + 8;

function resolveSafeBottom(bottomInset: number) {
  return Math.max(bottomInset, MIN_SAFE_BOTTOM);
}

export function getDockContentPadding(bottomInset: number) {
  return resolveSafeBottom(bottomInset) + FLOATING_DOCK_CLEARANCE;
}

export function getFloatingFilterBottomOffset(bottomInset: number) {
  return resolveSafeBottom(bottomInset) + FLOATING_FILTER_BOTTOM_OFFSET;
}

export function getFloatingFilterContentPadding(bottomInset: number) {
  return resolveSafeBottom(bottomInset) + FLOATING_FILTER_CLEARANCE;
}
