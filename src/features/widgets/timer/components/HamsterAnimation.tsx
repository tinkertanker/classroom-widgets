import React from 'react';

interface HamsterAnimationProps {
  pulseAngle: number;
  isOnColoredArc?: boolean;
}

export const HamsterAnimation: React.FC<HamsterAnimationProps> = ({ pulseAngle, isOnColoredArc = true }) => (
  <g transform={`rotate(${pulseAngle} 50 50)`}>
    <g transform="translate(50, 8) scale(0.9, -0.9)">
      {/* Add a subtle glow effect when on colored arc */}
      {isOnColoredArc && (
        <circle cx="0" cy="0" r="8" fill="rgba(255, 255, 0, 0.3)" filter="blur(2px)" />
      )}
      <ellipse cx="0" cy="0" rx="6" ry="4.5" fill={isOnColoredArc ? "#D2691E" : "#8B8B8B"} stroke="#8B4513" strokeWidth="0.8" />
      <circle cx="-4" cy="-1.5" r="3.5" fill={isOnColoredArc ? "#DEB887" : "#A9A9A9"} stroke="#8B4513" strokeWidth="0.8" />
      <circle cx="-5.5" cy="-3.5" r="1.3" fill={isOnColoredArc ? "#D2691E" : "#8B8B8B"} />
      <circle cx="-2.5" cy="-3.5" r="1.3" fill={isOnColoredArc ? "#D2691E" : "#8B8B8B"} />
      <circle cx="-5" cy="-1.5" r="0.7" fill="#000" />
      <circle cx="-3" cy="-1.5" r="0.7" fill="#000" />
      <circle cx="-4.8" cy="-1.8" r="0.3" fill="#fff" />
      <circle cx="-2.8" cy="-1.8" r="0.3" fill="#fff" />
      <circle cx="-6.5" cy="-0.5" r="0.4" fill="#8B4513" />
      <g>
        <ellipse cx="-2.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            values="0 -2.5 3.5;-30 -2.5 3.5;30 -2.5 3.5;0 -2.5 3.5"
            dur="0.4s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="-4" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            values="0 -4 3.5;30 -4 3.5;-30 -4 3.5;0 -4 3.5"
            dur="0.4s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="1.5" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            values="0 1.5 3.5;30 1.5 3.5;-30 1.5 3.5;0 1.5 3.5"
            dur="0.4s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="3" cy="3.5" rx="1" ry="1.5" fill="#654321" stroke="#3D2611" strokeWidth="0.3">
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            values="0 3 3.5;-30 3 3.5;30 3 3.5;0 3 3.5"
            dur="0.4s"
            repeatCount="indefinite"
          />
        </ellipse>
      </g>
      <path d="M 4.5 0 Q 7 -1.5 8.5 1" stroke="#8B4513" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </g>
  </g>
);