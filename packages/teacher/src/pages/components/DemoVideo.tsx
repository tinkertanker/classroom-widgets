import React, { useEffect, useRef, useState } from 'react';
import { FaVolumeHigh, FaVolumeXmark } from 'react-icons/fa6';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}

/**
 * Landing-page promo video. Autoplays muted and loops, with a sound toggle.
 * With prefers-reduced-motion it does not autoplay: it shows the poster and
 * native controls so the visitor chooses to play it.
 */
export const DemoVideo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion) {
      if (!video.paused) video.pause();
      return;
    }
    // React does not reliably reflect the `muted` prop as an attribute, and
    // browsers only autoplay muted media, so set it on the element directly.
    video.defaultMuted = true;
    video.muted = true;
    setMuted(true);
    const playing = video.play?.();
    if (playing && typeof playing.catch === 'function') playing.catch(() => undefined);
  }, [reducedMotion]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  };

  return (
    <figure className="relative mx-auto w-full max-w-4xl lg:max-w-none">
      <div className="relative overflow-hidden rounded-2xl border-4 border-white dark:border-warm-gray-700 bg-warm-gray-100 dark:bg-warm-gray-800 shadow-2xl aspect-video">
        <video
          ref={videoRef}
          className="block h-full w-full object-cover"
          poster="/promo/poster.jpg"
          autoPlay={!reducedMotion}
          muted={muted}
          loop
          playsInline
          controls={reducedMotion}
          preload="metadata"
          width={1920}
          height={1080}
          aria-label="Classroom Widgets demo video: the Timer, Text Banner, Traffic Light, Randomiser and Task Cue widgets in action"
          title="Classroom Widgets demo"
        >
          <source src="/promo/classroom-widgets-demo.webm" type="video/webm" />
          <source src="/promo/classroom-widgets-demo.mp4" type="video/mp4" />
        </video>
        {!reducedMotion && (
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={!muted}
            aria-label={muted ? 'Sound on' : 'Sound off'}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-warm-gray-900/75 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm lg:px-3 lg:py-1.5 lg:text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-warm-gray-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-warm-gray-900"
          >
            {muted ? <FaVolumeXmark aria-hidden="true" /> : <FaVolumeHigh aria-hidden="true" />}
            {muted ? 'Sound on' : 'Sound off'}
          </button>
        )}
      </div>
      <figcaption className="sr-only">
        A 34-second demo of Classroom Widgets with original background music.
      </figcaption>
    </figure>
  );
};
