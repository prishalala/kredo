// Small stroke icons used across the app (decorative: hidden from screen readers).
const base = {
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
};

export const LockIcon = () => (
  <svg {...base}><rect x="4" y="10" width="16" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
export const IdIcon = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2.2" /><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5" /></svg>
);
export const CheckIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16.5 9.5" /></svg>
);
export const ScaleIcon = () => (
  <svg {...base}><path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z" /></svg>
);
export const ShieldIcon = () => (
  <svg {...base}><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const ArrowIcon = () => (
  <svg {...base} width={18} height={18}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const EyeIcon = () => (
  <svg {...base} width={18} height={18}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const FingerprintIcon = () => (
  <svg {...base}><path d="M12 11v3a6 6 0 0 1-1.5 4M8.5 6.5A6 6 0 0 1 18 11v2M6 10a6 6 0 0 1 .8-3M9 11a3 3 0 0 1 6 0v3c0 1.6-.4 3.1-1.1 4.4M6 14c0 1.4-.3 2.7-.9 3.9M18 16c-.2 1-.5 2-1 2.9" /></svg>
);

export const KredoMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke="#ECB44D" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M32 22v76" /><path d="M36 64L84 22" /><path d="M52 70l16 18 32-38" />
  </svg>
);
