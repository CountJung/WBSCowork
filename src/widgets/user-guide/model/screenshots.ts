import reviewed from "../../../../public/guide/screenshots/reviewed-manifest.json";

/** Only reviewed, privacy-safe captures of the actual application belong here. */
export type GuideScreenshot = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  capturedAt: string;
  captureVersion: number;
  usageNotes: string;
  captureRole: "envSU";
  synthetic: true;
};

// Actual browser captures are supplied and reviewed separately from guide copy.
export const guideScreenshots: readonly GuideScreenshot[] = reviewed.screenshots.map(shot => ({
  ...shot, captureRole: "envSU", synthetic: true,
}));
