import React from 'react';

interface StickerIconProps {
  className?: string;
  style?: React.CSSProperties;
}

// Thumbs Up
export const CustomThumbsUp: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 16 16" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733.058.119.103.242.138.363.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.574.356-1.539.428-2.59z"/>
  </svg>
);

// Heart
export const CustomHeart: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 512 512" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <defs>
      <radialGradient id="heartGradient">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
      </radialGradient>
    </defs>
    <path d="M47.6 300.4L228.3 469.1c7.5 7 17.4 10.9 27.7 10.9s20.2-3.9 27.7-10.9L464.4 300.4c30.4-28.3 47.6-68 47.6-109.5v-5.8c0-69.9-50.5-129.5-119.4-141C347 36.5 300.6 51.4 268 84L256 96 244 84c-32.6-32.6-79-47.5-124.6-39.9C50.5 55.6 0 115.2 0 185.1v5.8c0 41.5 17.2 81.2 47.6 109.5z" fill="url(#heartGradient)"/>
  </svg>
);

// Star
export const CustomStar: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 576 512" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <defs>
      <radialGradient id="starGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.7"/>
        <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
      </radialGradient>
    </defs>
    <path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.4 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2 12 3 24.2 12.9 31.3s23 8 33.8 2.3l128.3-68.5 128.3 68.5c10.8 5.7 23.9 4.9 33.8-2.3s14.9-19.3 12.9-31.3L438.5 329 542.7 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z" fill="url(#starGradient)"/>
  </svg>
);

// Smile
export const CustomSmile: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 512 512" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <defs>
      <radialGradient id="smileGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
      </radialGradient>
    </defs>
    <g>
      {/* Face circle */}
      <circle cx="256" cy="256" r="240" fill="url(#smileGradient)"/>
      {/* Left eye */}
      <ellipse cx="180" cy="200" rx="28" ry="42" fill="white"/>
      {/* Right eye */}
      <ellipse cx="332" cy="200" rx="28" ry="42" fill="white"/>
      {/* Smile */}
      <path d="M180 320 Q256 380 332 320" stroke="white" strokeWidth="36" fill="none" strokeLinecap="round"/>
    </g>
  </svg>
);

// Arrow Up
export const CustomArrowUp: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 384 512" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <defs>
      <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.8"/>
        <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
      </linearGradient>
    </defs>
    <path d="M192 40C186 40 182 44 177 48L70 155C65 160 65 168 70 173C75 178 83 178 88 173L140 173L140 408C140 427.3 155.7 443 175 443L209 443C228.3 443 244 427.3 244 408L244 173L296 173C301 178 309 178 314 173C319 168 319 160 314 155L207 48C202 44 198 40 192 40z" fill="url(#arrowGradient)"/>
  </svg>
);

// Location Dot (Marker)
export const CustomLocationDot: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 384 512" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <path d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
  </svg>
);

// Rainbow
export const CustomRainbow: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 512 512" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <g transform="translate(0, 60)"> {/* Move the rainbow down */}
      {/* Outer red arc */}
      <path d="M256 80C362 80 448 166 448 272L448 320L416 320L416 272C416 183 343 112 256 112C169 112 96 183 96 272L96 320L64 320L64 272C64 166 150 80 256 80Z" fill="#ff4444"/>
      {/* Orange arc */}
      <path d="M256 112C343 112 416 183 416 272L416 320L384 320L384 272C384 201 327 144 256 144C185 144 128 201 128 272L128 320L96 320L96 272C96 183 169 112 256 112Z" fill="#ff8800"/>
      {/* Yellow arc */}
      <path d="M256 144C327 144 384 201 384 272L384 320L352 320L352 272C352 219 309 176 256 176C203 176 160 219 160 272L160 320L128 320L128 272C128 201 185 144 256 144Z" fill="#ffdd00"/>
      {/* Green arc */}
      <path d="M256 176C309 176 352 219 352 272L352 320L320 320L320 272C320 237 291 208 256 208C221 208 192 237 192 272L192 320L160 320L160 272C160 219 203 176 256 176Z" fill="#44dd44"/>
      {/* Blue arc */}
      <path d="M256 208C291 208 320 237 320 272L320 320L288 320L288 272C288 255 273 240 256 240C239 240 224 255 224 272L224 320L192 320L192 272C192 237 221 208 256 208Z" fill="#4488ff"/>
      {/* Purple arc */}
      <path d="M256 240C273 240 288 255 288 272L288 320L224 320L224 272C224 255 239 240 256 240Z" fill="#8844ff"/>
    </g>
  </svg>
);

// Check
export const CustomCheck: React.FC<StickerIconProps> = ({ className, style }) => (
  <svg 
    viewBox="0 0 448 512" 
    fill="currentColor" 
    className={className}
    style={style}
  >
    <defs>
      <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.8"/>
        <stop offset="100%" stopColor="currentColor" stopOpacity="1"/>
      </linearGradient>
    </defs>
    <path d="M438.6 105.4c18 18 18 47 0 65l-236 236c-18 18-47 18-65 0l-108-108c-18-18-18-47 0-65s47-18 65 0L160 299.1 373.6 105.4c18-18 47-18 65 0z" fill="url(#checkGradient)"/>
  </svg>
);

// Export all icons
export const CustomStickerIcons = {
  thumbsup: CustomThumbsUp,
  heart: CustomHeart,
  star: CustomStar,
  smile: CustomSmile,
  arrow: CustomArrowUp,
  marker: CustomLocationDot,
  fire: CustomRainbow,
  check: CustomCheck,
};