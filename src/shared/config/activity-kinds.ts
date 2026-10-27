export const activityKinds = ["meal", "facility", "senior_care", "child_care", "recreation", "other", "media"] as const;
export type ActivityKind = (typeof activityKinds)[number];

export const activityKindLabels: Record<ActivityKind, string> = {
  meal: "식사준비",
  facility: "시설보수",
  senior_care: "어르신 돌봄",
  child_care: "아동 돌봄",
  recreation: "레크레이션",
  media: "미디어",
  other: "기타",
};
