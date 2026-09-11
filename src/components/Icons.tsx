import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M7 4.8v14.4a.8.8 0 0 0 1.22.68l11.2-7.2a.8.8 0 0 0 0-1.36L8.22 4.12A.8.8 0 0 0 7 4.8Z" fill="currentColor" stroke="none" />
  </Icon>
);

export const PauseIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="6.5" y="4.5" width="4" height="15" rx="1.4" fill="currentColor" stroke="none" />
    <rect x="13.5" y="4.5" width="4" height="15" rx="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const PrevIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M18.5 6v12a.7.7 0 0 1-1.08.59L8.5 12.6a.7.7 0 0 1 0-1.2l8.92-6A.7.7 0 0 1 18.5 6Z" fill="currentColor" stroke="none" />
    <rect x="4.5" y="5" width="2.4" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const NextIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M5.5 6v12a.7.7 0 0 0 1.08.59l8.92-6a.7.7 0 0 0 0-1.2l-8.92-6A.7.7 0 0 0 5.5 6Z" fill="currentColor" stroke="none" />
    <rect x="17.1" y="5" width="2.4" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </Icon>
);

export const ShuffleIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M16 4h4v4M20 4l-6.5 6.5M4 20l6-6M16 20h4v-4M14.5 14.5 20 20M4 4l4.5 4.5" />
  </Icon>
);

export const RepeatIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M17 2.5 20.5 6 17 9.5" />
    <path d="M3.5 12V9.5A3.5 3.5 0 0 1 7 6h13.5" />
    <path d="M7 21.5 3.5 18 7 14.5" />
    <path d="M20.5 12v2.5a3.5 3.5 0 0 1-3.5 3.5H3.5" />
  </Icon>
);

export const RepeatOneIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M17 2.5 20.5 6 17 9.5" />
    <path d="M3.5 12V9.5A3.5 3.5 0 0 1 7 6h13.5" />
    <path d="M7 21.5 3.5 18 7 14.5" />
    <path d="M20.5 12v2.5a3.5 3.5 0 0 1-3.5 3.5H3.5" />
    <path d="M11 10.5 12.6 9.5V15" strokeWidth={2} />
  </Icon>
);

export const HeartIcon = ({ filled, ...p }: Props & { filled?: boolean }) => (
  <Icon {...p}>
    <path
      d="M12 20.2s-7.4-4.6-7.4-9.7A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.4 2.9c0 5.1-7.4 9.7-7.4 9.7Z"
      fill={filled ? 'currentColor' : 'none'}
    />
  </Icon>
);

export const QueueIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 6h11M4 11h11M4 16h7" />
    <path d="M17.5 13.5v5.2" />
    <circle cx="15.6" cy="18.8" r="1.9" />
    <path d="M17.5 13.5 21 12v5" />
  </Icon>
);

export const SearchIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Icon>
);

export const HomeIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" />
    <path d="M9.5 20.5v-6h5v6" />
  </Icon>
);

export const ClockIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const VolumeIcon = ({ level = 1, ...p }: Props & { level?: number }) => (
  <Icon {...p}>
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4Z" fill="currentColor" stroke="none" />
    {level === 0 ? (
      <path d="m16 9.5 4.5 5M20.5 9.5l-4.5 5" />
    ) : (
      <>
        <path d="M15.5 9.6a3.4 3.4 0 0 1 0 4.8" />
        {level > 0.55 && <path d="M18 7.2a6.8 6.8 0 0 1 0 9.6" />}
      </>
    )}
  </Icon>
);

export const MoonIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" />
  </Icon>
);

export const SunIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </Icon>
);

export const MoreIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
  </Icon>
);

export const CloseIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const ExpandIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 9.5V4h5.5M20 14.5V20h-5.5M14.5 4H20v5.5M9.5 20H4v-5.5" />
  </Icon>
);

export const CollapseIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M9.5 4v5.5H4M14.5 20v-5.5H20M20 9.5h-5.5V4M4 14.5h5.5V20" />
  </Icon>
);

export const MenuIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const GripIcon = (p: Props) => (
  <Icon {...p} size={p.size ?? 14}>
    <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const LyricsIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M4.5 5.5h10M4.5 10h15M4.5 14.5h8M4.5 19h11" />
  </Icon>
);

export const TimerIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M9.5 2.5h5" />
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 10v3.8l2.4 1.6" />
  </Icon>
);

export const KeyboardIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M8.5 14h7" />
  </Icon>
);

export const WaveIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M3 12h2M8 6.5v11M12 3.5v17M16 8v8M20.5 11h.5" />
  </Icon>
);
