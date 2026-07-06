export const colors = {
  primary: "#16a34a",
  primaryDark: "#15803d",
  surface: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  orange: "#f97316",
  red: "#dc2626"
};

export const spacing = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28
};

export const thresholdColor = (percentage: number) => {
  if (percentage >= 75) return colors.primary;
  if (percentage >= 60) return colors.orange;
  return colors.red;
};
