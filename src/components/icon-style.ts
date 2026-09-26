import type { IconWeight } from "@phosphor-icons/react";

/**
 * The one icon weight on the site. Bold sits with the 1.5px borders and
 * heavy type of the notice-board style; a lighter weight looks like it came
 * from a different product. Set here so no call site picks its own.
 *
 * Icons come from Phosphor rather than hand-drawn paths. The exception is
 * PinMark, which is the logo, not an icon.
 */
export const ICON_WEIGHT: IconWeight = "bold";
