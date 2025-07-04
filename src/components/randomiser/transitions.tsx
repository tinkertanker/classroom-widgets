import * as React from "react";

function Transitions({
  choice,
  open,
  animationspeed,
  slowanimation,
  children
}) {
  const duration = (animationspeed + slowanimation) * 1000;
  
  const getTransitionStyle = () => {
    const baseStyle = {
      transition: `all ${duration}ms ease-in-out`,
    };

    switch (choice) {
      case "Fade":
        return {
          ...baseStyle,
          opacity: open ? 1 : 0,
        };
      case "ScaleFade":
        return {
          ...baseStyle,
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1)' : 'scale(0.5)',
        };
      case "SlideFade":
        return {
          ...baseStyle,
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(20px)',
        };
      default:
        return baseStyle;
    }
  };

  return (
    <div style={getTransitionStyle()}>
      {children}
    </div>
  );
}

export default Transitions;