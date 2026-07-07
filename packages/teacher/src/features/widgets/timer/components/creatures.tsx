import React from 'react';

export type CreatureId = 'hamster' | 'pip' | 'tortoise' | 'fox' | 'bee' | 'penguin';

export interface CreatureDefinition {
  id: CreatureId;
  name: string;
  /** Multiplier applied to the base 120°/s lap speed. */
  speedFactor: number;
  /** Artwork shown while the runner is on the remaining rainbow arc. */
  Calm: React.FC;
  /** Artwork shown while the runner is on the spent grey track. */
  Shocked: React.FC;
}

// All creatures share the hamster's local frame: centred on (0, 0), facing
// -x (the direction of travel), feet on a baseline around y +4.5. The mount
// transform in CreatureAnimation flips y so feet point outward on the ring.

const HamsterFeetAndTail: React.FC = () => (
  <>
    <g>
      <ellipse cx="-2.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
      <ellipse cx="-4" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
      <ellipse cx="1.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
      <ellipse cx="3" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3" />
    </g>
    <path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="#8B4513" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </>
);

const HamsterCalm: React.FC = () => (
  <>
    <ellipse cx="0" cy="0" rx="6" ry="4.5" fill="#D2691E" stroke="#8B4513" strokeWidth="0.8" />
    <circle cx="-4" cy="-1.5" r="3.5" fill="#DEB887" stroke="#8B4513" strokeWidth="0.8" />
    <circle cx="-5.5" cy="-3.5" r="1.3" fill="#D2691E" />
    <circle cx="-2.5" cy="-3.5" r="1.3" fill="#D2691E" />
    <circle cx="-5" cy="-1.5" r="0.7" fill="#000" />
    <circle cx="-3" cy="-1.5" r="0.7" fill="#000" />
    <circle cx="-4.8" cy="-1.8" r="0.3" fill="#fff" />
    <circle cx="-2.8" cy="-1.8" r="0.3" fill="#fff" />
    <circle cx="-6.5" cy="-0.5" r="0.4" fill="#8B4513" />
    <HamsterFeetAndTail />
  </>
);

const HamsterShocked: React.FC = () => (
  <>
    <g stroke="#8B4513" strokeWidth="0.5" fill="none">
      <line x1="0" y1="-5" x2="0" y2="-8" />
      <line x1="3.5" y1="-3.5" x2="5.7" y2="-5.7" />
      <line x1="5" y1="0" x2="8" y2="0" />
      <line x1="3.5" y1="3.5" x2="5.7" y2="5.7" />
      <line x1="0" y1="5" x2="0" y2="8" />
      <line x1="-3.5" y1="3.5" x2="-5.7" y2="5.7" />
      <line x1="-5" y1="0" x2="-8" y2="0" />
      <line x1="-3.5" y1="-3.5" x2="-5.7" y2="-5.7" />
      <line x1="2.5" y1="-4.3" x2="3.5" y2="-6.5" />
      <line x1="4.3" y1="-2.5" x2="6.5" y2="-3.5" />
      <line x1="-2.5" y1="-4.3" x2="-3.5" y2="-6.5" />
      <line x1="-4.3" y1="-2.5" x2="-6.5" y2="-3.5" />
    </g>
    <ellipse cx="0" cy="0" rx="6" ry="4.5" fill="#D2691E" stroke="#8B4513" strokeWidth="0.8" />
    <circle cx="-4" cy="-1.5" r="5" fill="#DEB887" stroke="#8B4513" strokeWidth="0.8" />
    <circle cx="-6.5" cy="-4.5" r="1.8" fill="#D2691E" />
    <circle cx="-1.5" cy="-4.5" r="1.8" fill="#D2691E" />
    <circle cx="-5.5" cy="-1.5" r="1.2" fill="#fff" />
    <circle cx="-2.5" cy="-1.5" r="1.2" fill="#fff" />
    <circle cx="-5.5" cy="-1.5" r="0.8" fill="#000" />
    <circle cx="-2.5" cy="-1.5" r="0.8" fill="#000" />
    <ellipse cx="-4" cy="1" rx="0.8" ry="1.2" fill="#000" />
    <HamsterFeetAndTail />
  </>
);

// Pip — the hamster's modern cousin, in the app's terracotta palette.
const PipCalm: React.FC = () => (
  <>
    <circle cx="6" cy="0.4" r="1.2" fill="#db9a6d" stroke="#975230" strokeWidth="0.6" />
    <ellipse cx="0.6" cy="0.6" rx="5.6" ry="4.4" fill="#db9a6d" stroke="#975230" strokeWidth="0.8" />
    <ellipse cx="1.2" cy="2.6" rx="2.8" ry="1.8" fill="#f9ede3" opacity="0.85" />
    <circle cx="-6.6" cy="-6" r="1.6" fill="#db9a6d" stroke="#975230" strokeWidth="0.7" />
    <circle cx="-1.9" cy="-6.4" r="1.6" fill="#db9a6d" stroke="#975230" strokeWidth="0.7" />
    <circle cx="-6.6" cy="-6" r="0.75" fill="#e09494" />
    <circle cx="-1.9" cy="-6.4" r="0.75" fill="#e09494" />
    <circle cx="-4.2" cy="-2.4" r="4.3" fill="#db9a6d" stroke="#975230" strokeWidth="0.8" />
    <ellipse cx="-6.1" cy="-0.7" rx="2.3" ry="1.8" fill="#f9ede3" />
    <circle cx="-5.9" cy="-3.1" r="0.75" fill="#2d2926" />
    <circle cx="-2.5" cy="-3.3" r="0.75" fill="#2d2926" />
    <circle cx="-6.15" cy="-3.35" r="0.28" fill="#fff" />
    <circle cx="-2.75" cy="-3.55" r="0.28" fill="#fff" />
    <ellipse cx="-8" cy="-2" rx="0.8" ry="0.5" fill="#e09494" opacity="0.75" />
    <ellipse cx="-1" cy="-2.1" rx="0.8" ry="0.5" fill="#e09494" opacity="0.75" />
    <ellipse cx="-7.4" cy="-1.1" rx="0.5" ry="0.4" fill="#975230" />
    <path d="M -7 -0.2 Q -6.3 0.5 -5.5 -0.1" stroke="#975230" strokeWidth="0.45" fill="none" strokeLinecap="round" />
    <ellipse cx="-3.6" cy="4.4" rx="0.95" ry="1.25" fill="#975230" />
    <ellipse cx="-1.7" cy="4.7" rx="0.95" ry="1.25" fill="#975230" />
    <ellipse cx="1.7" cy="4.7" rx="0.95" ry="1.25" fill="#975230" />
    <ellipse cx="3.5" cy="4.4" rx="0.95" ry="1.25" fill="#975230" />
  </>
);

const PipShocked: React.FC = () => (
  <>
    <g stroke="#975230" strokeWidth="0.5" fill="none" strokeLinecap="round">
      <line x1="-8.5" y1="-6.6" x2="-10.3" y2="-8" />
      <line x1="-6.4" y1="-8.2" x2="-7.4" y2="-10.3" />
      <line x1="-4.2" y1="-8.8" x2="-4.2" y2="-11.1" />
      <line x1="-2" y1="-8.2" x2="-1" y2="-10.3" />
      <line x1="-9.4" y1="-4.2" x2="-11.6" y2="-4.9" />
    </g>
    <circle cx="6.2" cy="-0.6" r="1.2" fill="#db9a6d" stroke="#975230" strokeWidth="0.6" />
    <ellipse cx="0.6" cy="0.6" rx="5.6" ry="4.4" fill="#db9a6d" stroke="#975230" strokeWidth="0.8" />
    <ellipse cx="1.2" cy="2.6" rx="2.8" ry="1.8" fill="#f9ede3" opacity="0.85" />
    <circle cx="-7.6" cy="-5.2" r="1.6" fill="#db9a6d" stroke="#975230" strokeWidth="0.7" />
    <circle cx="-0.9" cy="-6.6" r="1.6" fill="#db9a6d" stroke="#975230" strokeWidth="0.7" />
    <circle cx="-7.6" cy="-5.2" r="0.75" fill="#e09494" />
    <circle cx="-0.9" cy="-6.6" r="0.75" fill="#e09494" />
    <circle cx="-4.2" cy="-2.4" r="4.3" fill="#db9a6d" stroke="#975230" strokeWidth="0.8" />
    <ellipse cx="-6.1" cy="-0.7" rx="2.3" ry="1.8" fill="#f9ede3" />
    <circle cx="-5.9" cy="-3.1" r="1.25" fill="#fff" stroke="#975230" strokeWidth="0.35" />
    <circle cx="-2.5" cy="-3.3" r="1.25" fill="#fff" stroke="#975230" strokeWidth="0.35" />
    <circle cx="-5.9" cy="-3.1" r="0.5" fill="#2d2926" />
    <circle cx="-2.5" cy="-3.3" r="0.5" fill="#2d2926" />
    <ellipse cx="-7.4" cy="-1.4" rx="0.5" ry="0.4" fill="#975230" />
    <ellipse cx="-6.2" cy="0.2" rx="0.75" ry="0.95" fill="#78422a" />
    <path d="M 1.6 -8 C 2.5 -6.7 2.6 -5.9 1.6 -5.4 C 0.6 -5.9 0.7 -6.7 1.6 -8 Z" fill="#8fb8dd" />
    <ellipse cx="-4.4" cy="4.5" rx="0.95" ry="1.25" fill="#975230" />
    <ellipse cx="-2" cy="4.6" rx="0.95" ry="1.25" fill="#975230" />
    <ellipse cx="2" cy="4.6" rx="0.95" ry="1.25" fill="#975230" />
    <ellipse cx="4.3" cy="4.5" rx="0.95" ry="1.25" fill="#975230" />
  </>
);

const TortoiseShell: React.FC = () => (
  <>
    <path d="M -5.2 2 Q -5.2 -5.2 0 -5.2 Q 5.2 -5.2 5.2 2 Z" fill="#4a8f5f" stroke="#2d5c3c" strokeWidth="0.8" />
    <path d="M -2.2 -4.7 Q -2.6 -1.2 -2.1 1.8" stroke="#39744c" strokeWidth="0.5" fill="none" />
    <path d="M 1.9 -4.8 Q 2.4 -1.2 1.9 1.8" stroke="#39744c" strokeWidth="0.5" fill="none" />
    <path d="M -4.7 -1.7 Q 0 -3.2 4.7 -1.7" stroke="#39744c" strokeWidth="0.5" fill="none" />
    <rect x="-5.9" y="1.6" width="11.8" height="1.9" rx="0.95" fill="#39744c" stroke="#2d5c3c" strokeWidth="0.7" />
  </>
);

const TortoiseCalm: React.FC = () => (
  <>
    <circle cx="6.4" cy="2.2" r="1" fill="#b8d4c0" stroke="#2d5c3c" strokeWidth="0.6" />
    <ellipse cx="-3.2" cy="3.9" rx="1.3" ry="1.7" fill="#b8d4c0" stroke="#2d5c3c" strokeWidth="0.7" />
    <ellipse cx="3" cy="3.9" rx="1.3" ry="1.7" fill="#b8d4c0" stroke="#2d5c3c" strokeWidth="0.7" />
    <ellipse cx="-6.6" cy="-0.4" rx="2.1" ry="2.3" fill="#b8d4c0" stroke="#2d5c3c" strokeWidth="0.8" />
    <circle cx="-7.2" cy="-1.1" r="0.6" fill="#2d2926" />
    <circle cx="-7.4" cy="-1.3" r="0.22" fill="#fff" />
    <ellipse cx="-8" cy="-0.1" rx="0.55" ry="0.35" fill="#e09494" opacity="0.6" />
    <path d="M -7.5 0.5 Q -6.9 1.1 -6.2 0.6" stroke="#2d5c3c" strokeWidth="0.45" fill="none" strokeLinecap="round" />
    <TortoiseShell />
  </>
);

const TortoiseShocked: React.FC = () => (
  <>
    <g stroke="#2d5c3c" strokeWidth="0.5" fill="none" strokeLinecap="round">
      <line x1="-4.8" y1="-6.6" x2="-6.2" y2="-8.4" />
      <line x1="-2.2" y1="-7.4" x2="-2.8" y2="-9.6" />
      <line x1="0.4" y1="-7.6" x2="0.4" y2="-10" />
      <line x1="3" y1="-7.4" x2="3.6" y2="-9.6" />
      <line x1="5.2" y1="-6.4" x2="6.6" y2="-8.2" />
    </g>
    <ellipse cx="-5.1" cy="0.2" rx="2.2" ry="2.1" fill="#b8d4c0" stroke="#2d5c3c" strokeWidth="0.8" />
    <circle cx="-6" cy="-0.3" r="1.25" fill="#fff" stroke="#2d5c3c" strokeWidth="0.35" />
    <circle cx="-6.2" cy="-0.3" r="0.55" fill="#2d2926" />
    <TortoiseShell />
    <ellipse cx="-2.8" cy="4.2" rx="1.15" ry="1.05" fill="#b8d4c0" stroke="#2d5c3c" strokeWidth="0.7" />
    <ellipse cx="2.6" cy="4.2" rx="1.15" ry="1.05" fill="#b8d4c0" stroke="#2d5c3c" strokeWidth="0.7" />
    <path d="M 7 -6.8 C 7.9 -5.5 8 -4.7 7 -4.2 C 6 -4.7 6.1 -5.5 7 -6.8 Z" fill="#8fb8dd" />
  </>
);

const FoxCalm: React.FC = () => (
  <>
    <g transform="rotate(-30 4.5 0)">
      <ellipse cx="7.2" cy="0" rx="3.5" ry="1.8" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.8" />
      <circle cx="9.6" cy="0" r="1.35" fill="#f9ede3" stroke="#78422a" strokeWidth="0.6" />
    </g>
    <path d="M -7 -4.4 L -8.2 -8.4 L -4.8 -6 Z" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.7" strokeLinejoin="round" />
    <path d="M -3.7 -4.9 L -2.5 -8.8 L -1.7 -5 Z" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.7" strokeLinejoin="round" />
    <path d="M -6.8 -5.3 L -7.4 -7.3 L -5.7 -6.1 Z" fill="#f2d9c4" />
    <path d="M -3.2 -5.6 L -2.6 -7.5 L -2.2 -5.6 Z" fill="#f2d9c4" />
    <ellipse cx="0.6" cy="0.8" rx="5.2" ry="3.9" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.8" />
    <ellipse cx="-2.8" cy="1.4" rx="1.8" ry="2.4" fill="#f9ede3" />
    <circle cx="-4.4" cy="-2.6" r="3.7" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.8" />
    <path d="M -6.4 -2.4 L -8.6 -0.9 L -5.9 -0.2 Z" fill="#f9ede3" stroke="#78422a" strokeWidth="0.5" strokeLinejoin="round" />
    <circle cx="-8.4" cy="-1" r="0.55" fill="#78422a" />
    <path d="M -6.4 -3.6 Q -5.9 -4.3 -5.4 -3.6" stroke="#2d2926" strokeWidth="0.7" fill="none" strokeLinecap="round" />
    <path d="M -3.6 -3.8 Q -3.1 -4.5 -2.6 -3.8" stroke="#2d2926" strokeWidth="0.7" fill="none" strokeLinecap="round" />
    <ellipse cx="-4" cy="4.2" rx="0.95" ry="1.2" fill="#78422a" />
    <ellipse cx="-2" cy="4.5" rx="0.95" ry="1.2" fill="#78422a" />
    <ellipse cx="1.6" cy="4.5" rx="0.95" ry="1.2" fill="#78422a" />
    <ellipse cx="3.6" cy="4.2" rx="0.95" ry="1.2" fill="#78422a" />
  </>
);

const FoxShocked: React.FC = () => (
  <>
    <g stroke="#78422a" strokeWidth="0.5" fill="none" strokeLinecap="round">
      <line x1="-9.6" y1="-4.4" x2="-11.6" y2="-5.2" />
      <line x1="-9" y1="-7" x2="-10.6" y2="-8.6" />
      <line x1="-5.4" y1="-9" x2="-6" y2="-11.2" />
      <line x1="-1.6" y1="-9.2" x2="-1" y2="-11.4" />
    </g>
    <path
      d="M 4.4 0 L 5.7 -2 L 6.7 -0.9 L 7.8 -2.2 L 8.8 -0.9 L 10.1 -1.8 L 10.5 0.1 L 10 1.9 L 8.7 1 L 7.7 2.2 L 6.6 1 L 5.6 2 Z"
      fill="#cc7d4a"
      stroke="#78422a"
      strokeWidth="0.7"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="0.1" r="0.9" fill="#f9ede3" />
    <g transform="rotate(28 -5.9 -5.2)">
      <path d="M -7 -4.4 L -8.2 -8.4 L -4.8 -6 Z" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M -6.8 -5.3 L -7.4 -7.3 L -5.7 -6.1 Z" fill="#f2d9c4" />
    </g>
    <g transform="rotate(24 -2.7 -4.95)">
      <path d="M -3.7 -4.9 L -2.5 -8.8 L -1.7 -5 Z" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M -3.2 -5.6 L -2.6 -7.5 L -2.2 -5.6 Z" fill="#f2d9c4" />
    </g>
    <ellipse cx="0.6" cy="0.8" rx="5.2" ry="3.9" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.8" />
    <ellipse cx="-2.8" cy="1.4" rx="1.8" ry="2.4" fill="#f9ede3" />
    <circle cx="-4.4" cy="-2.6" r="3.7" fill="#cc7d4a" stroke="#78422a" strokeWidth="0.8" />
    <path d="M -6.4 -2.4 L -8.6 -0.9 L -5.9 -0.2 Z" fill="#f9ede3" stroke="#78422a" strokeWidth="0.5" strokeLinejoin="round" />
    <circle cx="-8.4" cy="-1" r="0.55" fill="#78422a" />
    <circle cx="-5.9" cy="-3.6" r="1.15" fill="#fff" stroke="#78422a" strokeWidth="0.35" />
    <circle cx="-3.1" cy="-3.8" r="1.15" fill="#fff" stroke="#78422a" strokeWidth="0.35" />
    <circle cx="-5.9" cy="-3.6" r="0.48" fill="#2d2926" />
    <circle cx="-3.1" cy="-3.8" r="0.48" fill="#2d2926" />
    <ellipse cx="-7.3" cy="-1.2" rx="0.55" ry="0.7" fill="#78422a" />
    <path d="M 1.4 -8.2 C 2.3 -6.9 2.4 -6.1 1.4 -5.6 C 0.4 -6.1 0.5 -6.9 1.4 -8.2 Z" fill="#8fb8dd" />
    <ellipse cx="-4.6" cy="4.3" rx="0.95" ry="1.2" fill="#78422a" />
    <ellipse cx="-2.2" cy="4.4" rx="0.95" ry="1.2" fill="#78422a" />
    <ellipse cx="2" cy="4.4" rx="0.95" ry="1.2" fill="#78422a" />
    <ellipse cx="4.2" cy="4.3" rx="0.95" ry="1.2" fill="#78422a" />
  </>
);

const BeeCalm: React.FC = () => (
  <>
    <ellipse cx="-0.6" cy="-6.6" rx="2.7" ry="1.5" transform="rotate(-28 -0.6 -6.6)" fill="#fdfcfb" opacity="0.9" stroke="#948b7f" strokeWidth="0.5" />
    <ellipse cx="2.4" cy="-6.2" rx="2.5" ry="1.4" transform="rotate(-12 2.4 -6.2)" fill="#fdfcfb" opacity="0.9" stroke="#948b7f" strokeWidth="0.5" />
    <path d="M 5 -2.5 L 6.9 -1.9 L 5 -1.1 Z" fill="#3d3835" className="dark:fill-warm-gray-500" />
    <ellipse cx="0.6" cy="-2" rx="4.6" ry="3.4" fill="#e3b23c" stroke="#3d3835" strokeWidth="0.8" className="dark:stroke-warm-gray-500" />
    <path d="M 0.3 -5.1 Q 1.2 -2 0.3 1.05" stroke="#3d3835" strokeWidth="1.5" fill="none" />
    <path d="M 3 -4.6 Q 3.7 -2 3 0.55" stroke="#3d3835" strokeWidth="1.3" fill="none" />
    <circle cx="-4.4" cy="-2.4" r="2.5" fill="#3d3835" stroke="#3d3835" strokeWidth="0.45" className="dark:stroke-warm-gray-500" />
    <path d="M -5.4 -4.6 Q -6.2 -6.4 -7.3 -6.9" stroke="#3d3835" strokeWidth="0.5" fill="none" className="dark:stroke-warm-gray-500" />
    <circle cx="-7.5" cy="-7" r="0.45" fill="#3d3835" className="dark:fill-warm-gray-500" />
    <path d="M -3.6 -4.8 Q -3.6 -6.8 -4.3 -7.7" stroke="#3d3835" strokeWidth="0.5" fill="none" className="dark:stroke-warm-gray-500" />
    <circle cx="-4.5" cy="-7.9" r="0.45" fill="#3d3835" className="dark:fill-warm-gray-500" />
    <circle cx="-5.3" cy="-2.8" r="0.62" fill="#fdfcfb" />
    <circle cx="-3.6" cy="-2.9" r="0.62" fill="#fdfcfb" />
    <circle cx="-5.4" cy="-2.75" r="0.28" fill="#2d2926" />
    <circle cx="-3.7" cy="-2.85" r="0.28" fill="#2d2926" />
    <path d="M -5.1 -1.5 Q -4.5 -0.9 -3.9 -1.5" stroke="#fdfcfb" strokeWidth="0.45" fill="none" strokeLinecap="round" />
    <path d="M -2 1.3 Q -2.2 2.4 -1.6 3" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinecap="round" className="dark:stroke-warm-gray-500" />
    <path d="M 0.4 1.5 Q 0.2 2.6 0.8 3.2" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinecap="round" className="dark:stroke-warm-gray-500" />
    <path d="M 2.7 1.1 Q 2.7 2.2 3.3 2.8" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinecap="round" className="dark:stroke-warm-gray-500" />
  </>
);

const BeeShocked: React.FC = () => (
  <>
    <g stroke="#948b7f" strokeWidth="0.55" fill="none" strokeLinecap="round">
      <line x1="6.8" y1="-3.6" x2="9.6" y2="-3.9" />
      <line x1="7.2" y1="-1" x2="10" y2="-1" />
      <line x1="6.9" y1="1.4" x2="9.4" y2="1.8" />
    </g>
    <g transform="rotate(10 0 -2)">
      <ellipse cx="-1.4" cy="-6.9" rx="2.7" ry="1.4" transform="rotate(-46 -1.4 -6.9)" fill="#fdfcfb" opacity="0.35" stroke="#948b7f" strokeWidth="0.4" />
      <ellipse cx="3.4" cy="-6.4" rx="2.5" ry="1.3" transform="rotate(4 3.4 -6.4)" fill="#fdfcfb" opacity="0.35" stroke="#948b7f" strokeWidth="0.4" />
      <ellipse cx="-0.6" cy="-6.6" rx="2.7" ry="1.5" transform="rotate(-28 -0.6 -6.6)" fill="#fdfcfb" opacity="0.9" stroke="#948b7f" strokeWidth="0.5" />
      <ellipse cx="2.4" cy="-6.2" rx="2.5" ry="1.4" transform="rotate(-12 2.4 -6.2)" fill="#fdfcfb" opacity="0.9" stroke="#948b7f" strokeWidth="0.5" />
      <path d="M 5 -2.5 L 6.9 -1.9 L 5 -1.1 Z" fill="#3d3835" className="dark:fill-warm-gray-500" />
      <ellipse cx="0.6" cy="-2" rx="4.6" ry="3.4" fill="#e3b23c" stroke="#3d3835" strokeWidth="0.8" className="dark:stroke-warm-gray-500" />
      <path d="M 0.3 -5.1 Q 1.2 -2 0.3 1.05" stroke="#3d3835" strokeWidth="1.5" fill="none" />
      <path d="M 3 -4.6 Q 3.7 -2 3 0.55" stroke="#3d3835" strokeWidth="1.3" fill="none" />
      <circle cx="-4.4" cy="-2.4" r="2.5" fill="#3d3835" stroke="#3d3835" strokeWidth="0.45" className="dark:stroke-warm-gray-500" />
      <path d="M -5.2 -4.6 L -5.9 -6.2 L -5.1 -7.6" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinejoin="round" className="dark:stroke-warm-gray-500" />
      <circle cx="-5.1" cy="-7.8" r="0.45" fill="#3d3835" className="dark:fill-warm-gray-500" />
      <path d="M -3.5 -4.8 L -3.1 -6.4 L -2.2 -7.6" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinejoin="round" className="dark:stroke-warm-gray-500" />
      <circle cx="-2.1" cy="-7.8" r="0.45" fill="#3d3835" className="dark:fill-warm-gray-500" />
      <circle cx="-5.3" cy="-2.8" r="0.95" fill="#fdfcfb" />
      <circle cx="-3.5" cy="-2.9" r="0.95" fill="#fdfcfb" />
      <circle cx="-5.3" cy="-2.8" r="0.4" fill="#2d2926" />
      <circle cx="-3.5" cy="-2.9" r="0.4" fill="#2d2926" />
      <circle cx="-4.4" cy="-1.1" r="0.55" fill="#2d2926" />
      <path d="M -2 1.3 Q -1.6 2.4 -2.2 3" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinecap="round" className="dark:stroke-warm-gray-500" />
      <path d="M 0.4 1.5 Q 0.8 2.6 0.2 3.2" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinecap="round" className="dark:stroke-warm-gray-500" />
      <path d="M 2.7 1.1 Q 3.1 2.2 2.5 2.8" stroke="#3d3835" strokeWidth="0.5" fill="none" strokeLinecap="round" className="dark:stroke-warm-gray-500" />
    </g>
    <path d="M -0.4 -10 C 0.5 -8.7 0.6 -7.9 -0.4 -7.4 C -1.4 -7.9 -1.3 -8.7 -0.4 -10 Z" fill="#8fb8dd" />
  </>
);

const PenguinBody: React.FC = () => (
  <>
    <path
      d="M 0 -6.4 C 3.4 -6.4 4.6 -3.4 4.6 0 C 4.6 3 2.8 4.6 0 4.6 C -2.8 4.6 -4.6 3 -4.6 0 C -4.6 -3.4 -3.4 -6.4 0 -6.4 Z"
      fill="#514b44"
      stroke="#2d2926"
      strokeWidth="0.8"
    />
    <ellipse cx="-0.2" cy="1.2" rx="3.1" ry="3.2" fill="#fdfcfb" />
    <ellipse cx="-1.5" cy="-3.6" rx="2.4" ry="2" fill="#fdfcfb" />
  </>
);

const PenguinCalm: React.FC = () => (
  <>
    <ellipse cx="-4" cy="0" rx="1" ry="2.7" transform="rotate(18 -4 0)" fill="#514b44" stroke="#2d2926" strokeWidth="0.5" className="dark:fill-warm-gray-600" />
    <ellipse cx="4.2" cy="0" rx="1" ry="2.7" transform="rotate(-18 4.2 0)" fill="#514b44" stroke="#2d2926" strokeWidth="0.5" className="dark:fill-warm-gray-600" />
    <ellipse cx="-1.8" cy="4.5" rx="1.5" ry="0.85" fill="#cc7d4a" stroke="#975230" strokeWidth="0.5" />
    <ellipse cx="1.4" cy="4.8" rx="1.5" ry="0.85" fill="#cc7d4a" stroke="#975230" strokeWidth="0.5" />
    <PenguinBody />
    <circle cx="-2.5" cy="-3.9" r="0.65" fill="#2d2926" />
    <circle cx="-0.6" cy="-3.9" r="0.65" fill="#2d2926" />
    <circle cx="-2.7" cy="-4.1" r="0.24" fill="#fff" />
    <circle cx="-0.8" cy="-4.1" r="0.24" fill="#fff" />
    <ellipse cx="-3.2" cy="-2.9" rx="0.55" ry="0.35" fill="#e09494" opacity="0.65" />
    <ellipse cx="0.4" cy="-2.9" rx="0.55" ry="0.35" fill="#e09494" opacity="0.65" />
    <path d="M -1.6 -3 L -3.9 -2.3 L -1.6 -1.7 Z" fill="#cc7d4a" stroke="#975230" strokeWidth="0.4" strokeLinejoin="round" />
  </>
);

const PenguinShocked: React.FC = () => (
  <>
    <g stroke="#514b44" strokeWidth="0.5" fill="none" strokeLinecap="round" className="dark:stroke-warm-gray-500">
      <line x1="-3.4" y1="-7.4" x2="-4.6" y2="-9.2" />
      <line x1="-1.4" y1="-8.2" x2="-1.9" y2="-10.4" />
      <line x1="0.8" y1="-8.4" x2="0.8" y2="-10.8" />
      <line x1="3" y1="-8.2" x2="3.5" y2="-10.4" />
    </g>
    <ellipse cx="-4.9" cy="-2.6" rx="1" ry="2.7" transform="rotate(48 -4.9 -2.6)" fill="#514b44" stroke="#2d2926" strokeWidth="0.5" className="dark:fill-warm-gray-600" />
    <ellipse cx="5.1" cy="-2.6" rx="1" ry="2.7" transform="rotate(-48 5.1 -2.6)" fill="#514b44" stroke="#2d2926" strokeWidth="0.5" className="dark:fill-warm-gray-600" />
    <ellipse cx="-2.4" cy="4.7" rx="1.5" ry="0.85" transform="rotate(-16 -2.4 4.7)" fill="#cc7d4a" stroke="#975230" strokeWidth="0.5" />
    <ellipse cx="2" cy="4.7" rx="1.5" ry="0.85" transform="rotate(16 2 4.7)" fill="#cc7d4a" stroke="#975230" strokeWidth="0.5" />
    <PenguinBody />
    <circle cx="-2.5" cy="-3.9" r="0.9" fill="#fff" stroke="#2d2926" strokeWidth="0.3" />
    <circle cx="-0.6" cy="-3.9" r="0.9" fill="#fff" stroke="#2d2926" strokeWidth="0.3" />
    <circle cx="-2.5" cy="-3.9" r="0.42" fill="#2d2926" />
    <circle cx="-0.6" cy="-3.9" r="0.42" fill="#2d2926" />
    <path d="M -1.5 -3.2 L -3.9 -3.6 L -1.5 -2.4 Z" fill="#cc7d4a" stroke="#975230" strokeWidth="0.4" strokeLinejoin="round" />
    <path d="M -1.5 -2.1 L -3.3 -0.6 L -1.5 -1.2 Z" fill="#cc7d4a" stroke="#975230" strokeWidth="0.4" strokeLinejoin="round" />
    <path d="M 4.2 -8.2 C 5.1 -6.9 5.2 -6.1 4.2 -5.6 C 3.2 -6.1 3.3 -6.9 4.2 -8.2 Z" fill="#8fb8dd" />
  </>
);

export const CREATURES: Record<CreatureId, CreatureDefinition> = {
  hamster: { id: 'hamster', name: 'Hamster', speedFactor: 1, Calm: HamsterCalm, Shocked: HamsterShocked },
  pip: { id: 'pip', name: 'Pip', speedFactor: 1, Calm: PipCalm, Shocked: PipShocked },
  tortoise: { id: 'tortoise', name: 'Tortoise', speedFactor: 0.85, Calm: TortoiseCalm, Shocked: TortoiseShocked },
  fox: { id: 'fox', name: 'Fox', speedFactor: 1.15, Calm: FoxCalm, Shocked: FoxShocked },
  bee: { id: 'bee', name: 'Bee', speedFactor: 1, Calm: BeeCalm, Shocked: BeeShocked },
  penguin: { id: 'penguin', name: 'Penguin', speedFactor: 1, Calm: PenguinCalm, Shocked: PenguinShocked }
};

export const CREATURE_ORDER: CreatureId[] = ['hamster', 'pip', 'tortoise', 'fox', 'bee', 'penguin'];

export function isCreatureId(value: unknown): value is CreatureId {
  return typeof value === 'string' && (CREATURE_ORDER as string[]).includes(value);
}

export function getNextCreature(current: CreatureId): CreatureId {
  const index = CREATURE_ORDER.indexOf(current);
  return CREATURE_ORDER[(index + 1) % CREATURE_ORDER.length];
}
