type IconName =
  | "cube"
  | "pointer"
  | "grid"
  | "rotate"
  | "trash"
  | "plus"
  | "minus"
  | "fit"
  | "home"
  | "chevron"
  | "panel"
  | "close"
  | "focus"
  | "mouse"
  | "layers";
const paths: Record<IconName, string> = {
  cube: "m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v8M7.5 5.5l9 5",
  pointer: "m5 3 14 10-7 1-3 7-4-18Z",
  grid: "M3 3h18v18H3V3Zm6 0v18m6-18v18M3 9h18M3 15h18",
  rotate: "M3 9a9 9 0 1 1 0 6M3 3v6h6",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8V8Z",
  home: "m3 11 9-8 9 8M5 9v12h14V9M9 21v-8h6v8",
  chevron: "m9 5 7 7-7 7",
  panel: "M3 4h18v16H3V4Zm12 0v16",
  close: "m6 6 12 12M6 18 18 6",
  focus: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8",
  mouse: "M7 10V7a5 5 0 0 1 10 0v10a5 5 0 0 1-10 0v-7Zm5-8v7",
  layers: "m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
