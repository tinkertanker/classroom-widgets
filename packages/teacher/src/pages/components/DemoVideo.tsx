import React, { useRef, useState } from 'react';
import { FaPause, FaPlay, FaVolumeHigh, FaVolumeXmark } from 'react-icons/fa6';

type PlaybackState = 'idle' | 'playing' | 'paused';

const POSTER_SRC = '/promo/poster.jpg';

/**
 * Landing-page promo video. Click to play, never autoplays.
 *
 * Before playback (and again after it ends) the exact final frame is shown as an
 * <img> overlay with a "Play" button (muted) and a smaller "Play with sound"
 * button in the top-right corner. Hovering anywhere on the frame highlights Play,
 * and clicking anywhere on it (other than "Play with sound") plays muted. The poster attribute alone is not enough: some browsers swap it for the
 * first frame once media data loads, so the overlay is a real image and the video
 * uses preload="none".
 *
 * While playing, clicking the video pauses or resumes it; a small play/pause
 * button (bottom left) and a Sound on/off toggle (bottom right) do the same from
 * the keyboard.
 */
export const DemoVideo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playback, setPlayback] = useState<PlaybackState>('idle');
  const [muted, setMuted] = useState(true);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    const attempt = video.play?.();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => setPlayback(video.currentTime > 0 ? 'paused' : 'idle'));
    }
  };

  const start = (withSound: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !withSound;
    setMuted(!withSound);
    if (video.ended || playback === 'idle') video.currentTime = 0;
    setPlayback('playing');
    play();
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setPlayback('playing');
      play();
    } else {
      video.pause();
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
  };

  const idle = playback === 'idle';
  const controlClass =
    'absolute bottom-2 sm:bottom-3 inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-warm-gray-900/75 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm lg:px-3 lg:py-1.5 lg:text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-warm-gray-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-warm-gray-900';

  return (
    <figure className="relative mx-auto w-full max-w-4xl lg:max-w-none">
      <div className="relative overflow-hidden rounded-2xl border-4 border-white dark:border-warm-gray-700 bg-warm-gray-100 dark:bg-warm-gray-800 shadow-2xl aspect-video">
        <video
          ref={videoRef}
          className="block h-full w-full object-cover cursor-pointer"
          poster={POSTER_SRC}
          playsInline
          preload="none"
          width={1920}
          height={1080}
          onClick={idle ? undefined : togglePlayback}
          onPlay={() => setPlayback('playing')}
          onPause={(e) => { if (!e.currentTarget.ended) setPlayback('paused'); }}
          onEnded={() => setPlayback('idle')}
          aria-label="Classroom Widgets demo video: the Timer, Text Banner, Traffic Light, Randomiser and Task Cue widgets in action"
          title="Classroom Widgets demo"
        >
          <source src="/promo/classroom-widgets-demo.webm" type="video/webm" />
          <source src="/promo/classroom-widgets-demo.mp4" type="video/mp4" />
        </video>

        {idle ? (
          <div className="group absolute inset-0 cursor-pointer">
            <img
              src={POSTER_SRC}
              alt=""
              width={1920}
              height={1080}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Mouse/touch target: clicking anywhere on the still frame plays muted,
                like the Play button. Hidden from assistive tech; the real buttons
                below are the accessible controls. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-warm-gray-900/0 transition-colors group-hover:bg-warm-gray-900/10"
              onClick={() => start(false)}
            />
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col items-end gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => start(false)}
                aria-label="Play the demo video (muted)"
                className="inline-flex items-center gap-1.5 sm:gap-3 rounded-full bg-gradient-to-r from-terracotta-500 to-terracotta-600 px-3 py-1.5 sm:px-6 sm:py-3 text-sm sm:text-lg font-semibold text-white shadow-2xl ring-0 ring-white/80 transition-all group-hover:scale-105 group-hover:from-terracotta-600 group-hover:to-terracotta-700 group-hover:ring-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-terracotta-600"
              >
                <FaPlay aria-hidden="true" />
                Play
              </button>
              <button
                type="button"
                onClick={() => start(true)}
                aria-label="Play the demo video with sound"
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/90 px-2.5 py-0.5 sm:px-4 sm:py-1.5 text-[11px] sm:text-sm font-medium text-warm-gray-900 shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-warm-gray-900"
              >
                <FaVolumeHigh aria-hidden="true" />
                Play with sound
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={playback === 'playing' ? 'Pause' : 'Play'}
              className={`${controlClass} left-2 sm:left-3`}
            >
              {playback === 'playing' ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
              {playback === 'playing' ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={!muted}
              aria-label={muted ? 'Sound on' : 'Sound off'}
              className={`${controlClass} right-2 sm:right-3`}
            >
              {muted ? <FaVolumeXmark aria-hidden="true" /> : <FaVolumeHigh aria-hidden="true" />}
              {muted ? 'Sound on' : 'Sound off'}
            </button>
          </>
        )}
      </div>
      <figcaption className="sr-only">
        A 34-second demo of Classroom Widgets with original background music. It plays only when you press Play.
      </figcaption>
    </figure>
  );
};
