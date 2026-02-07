import React from 'react';

interface LaunchpadIconProps {
  size?: number;
}

const LaunchpadIcon: React.FC<LaunchpadIconProps> = ({ size = 24 }) => {
  const colors = [
    '#86b49f', // sage-500
    '#d4775c', // terracotta-500
    '#d99185', // dusty-rose-500
    '#7cb3a3', // sage-400
    '#e89a80', // terracotta-400
    '#ebb4a9', // dusty-rose-400
    '#5a9483', // sage-600
    '#c25e42', // terracotta-600
    '#c8766a', // dusty-rose-600
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 3x3 grid of colorful squares */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => {
          const index = row * 3 + col;
          return (
            <rect
              key={`${row}-${col}`}
              x={col * 7 + 1.5}
              y={row * 7 + 1.5}
              width="5"
              height="5"
              rx="1"
              fill={colors[index]}
            />
          );
        })
      )}
    </svg>
  );
};

export default LaunchpadIcon;