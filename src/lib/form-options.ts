export const choices = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value }));

export const timezoneChoices = [
  { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur (UTC+8)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Pacific/Auckland", label: "Auckland (seasonal offset)" },
  { value: "Australia/Sydney", label: "Sydney (seasonal offset)" },
  { value: "Europe/London", label: "London (seasonal offset)" },
  { value: "America/New_York", label: "New York (seasonal offset)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
];
