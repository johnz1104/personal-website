import { PAGE_SCALE } from "../river/sim/config.js";

// The menu's lowest point, in page units from the top of the river: where it sits in
// a 1440 x 790 window, 2.25rem from the bottom. The bank turns left toward the bottom
// of the window, and the panel opens beside the word, so much lower the email row would
// reach the bank. Taller windows keep it here, at the same spot in the river as the
// Flow box (a little below its level); shorter ones bring it to 2.25rem from their
// bottom.
const LOWEST = 905;

// The Contact menu's distance from the window's bottom, as a CSS length for the zoomed
// page content (one page unit is PAGE_SCALE px there). RiverLayout sets it as
// --contact-bottom; the menu and the scrolling pages (PageLayout `scrolls`) read it.
// `viewBottom`: the window's bottom in page units (windowView in config.js).
export function contactBottom(viewBottom) {
  return `max(2.25rem, ${(viewBottom - LOWEST) * PAGE_SCALE}px)`;
}
