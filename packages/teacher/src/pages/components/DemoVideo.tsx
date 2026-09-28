import React, { useEffect, useRef, useState } from 'react';
import { FaPause, FaPlay, FaVolumeHigh, FaVolumeXmark } from 'react-icons/fa6';

type PlaybackState = 'idle' | 'playing' | 'paused';

// Versioned file names: nginx serves images for a year, so a recut needs a new name.
const POSTER_SRC = '/promo/poster-v1.jpg';
const WEBM_SRC = '/promo/classroom-widgets-demo-v1.webm';
const MP4_SRC = '/promo/classroom-widgets-demo-v1.mp4';

// Clicks on the video this soon after starting are the tail of a double-click or
// double-tap on the still frame, not a request to pause.
const START_CLICK_GUARD_MS = 400;

/**
 * Landing-page promo video. Click to play, never autoplays.
 *
 * Before playback (and again after it ends) the exact final frame is shown as an
 * <img> overlay with a "Play" button (muted) and a smaller "Play with sound"
 * button in the top-right corner. Hovering anywhere on the frame highlights Play,
 * and clicking anywhere on it (other than "Play with sound") plays muted. The
 * poster attribute alone is not enough: some browsers swap it for the first frame
 * once media data loads, so the overlay is a real image and the video uses
 * preload="none".
 *
 * While playing, clicking the video pauses or resumes it; a small play/pause
 * button (bottom left) and a Sound on/off toggle (bottom right) do the same from
 * the keyboard. Keyboard focus follows the controls: to Pause after starting from
 * a button, and back to Play when the video ends.
 */
export const DemoVideo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const pauseButtonRef = useRef<HTMLButtonElement>(null);
  const startedAtRef = useRef(0);
  const focusAfterRenderRef = useRef<'pause' | 'play' | null>(null);
  const playAttemptRef = useRef(0);
  const [playback, setPlayback] = useState<PlaybackState>('idle');
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [frameHover, setFrameHover] = useState(false);

  useEffect(() => {
    const target = focusAfterRenderRef.current;
    if (!target) return;
    focusAfterRenderRef.current = null;
    (target === 'pause' ? pauseButtonRef : playButtonRef).current?.focus({ preventScroll: true });
  }, [playback]);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    // Only the latest play() may reset the state: an earlier one rejecting late
    // (for example when load() retries after a failure) must not undo a newer start.
    const id = ++playAttemptRef.current;
    const attempt = video.play?.();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        if (id !== playAttemptRef.current) return;
        setBuffering(false);
        setPlayback(video.currentTime > 0 ? 'paused' : 'idle');
      });
    }
  };

  const start = (withSound: boolean, fromButton: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !withSound;
    setMuted(!withSound);
    if (video.ended || playback === 'idle') video.currentTime = 0;
    // After every source failed once (offline, 404) the element stays in
    // NETWORK_NO_SOURCE and play() never settles; load() makes it retry.
    if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) video.load();
    startedAtRef.current = performance.now();
    if (fromButton) focusAfterRenderRef.current = 'pause';
    setBuffering(true);
    setFrameHover(false);
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

  const onVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (e.detail > 1 || performance.now() - startedAtRef.current < START_CLICK_GUARD_MS) return;
    togglePlayback();
  };

  const onEnded = () => {
    setBuffering(false);
    const active = document.activeElement;
    if (active && videoRef.current?.parentElement?.contains(active)) {
      focusAfterRenderRef.current = 'play';
    }
    setFrameHover(false);
    setPlayback('idle');
  };

  // The last <source> failing means no source could load (offline, 404): go back
  // to the final-frame overlay instead of leaving the spinner and Pause up.
  const onSourcesFailed = () => {
    setBuffering(false);
    const active = document.activeElement;
    if (active && videoRef.current?.parentElement?.contains(active)) {
      focusAfterRenderRef.current = 'play';
    }
    setPlayback('idle');
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
          onClick={idle ? undefined : onVideoClick}
          onPlay={() => setPlayback('playing')}
          onPause={(e) => { if (!e.currentTarget.ended) setPlayback('paused'); }}
          onEnded={onEnded}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          aria-label="Classroom Widgets demo video: the Timer, Text Banner, Traffic Light, Randomiser and Task Cue widgets in action"
          title="Classroom Widgets demo"
        >
          <source src={WEBM_SRC} type='video/webm; codecs="vp9, opus"' />
          <source src={MP4_SRC} type="video/mp4" onError={onSourcesFailed} />
        </video>

        {idle ? (
          <div className="absolute inset-0 cursor-pointer">
            <img
              src={POSTER_SRC}
              alt=""
              width={1920}
              height={1080}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Mouse/touch target: clicking anywhere on the still frame plays muted,
                like the Play button. Hidden from assistive tech; the real buttons
                are the accessible controls. Hovering it highlights Play; hovering
                "Play with sound" does not, because the buttons sit above it. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-warm-gray-900/0 transition-colors hover:bg-warm-gray-900/10"
              onClick={() => start(false, false)}
              onMouseEnter={() => setFrameHover(true)}
              onMouseLeave={() => setFrameHover(false)}
            />
            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col items-end gap-1.5 sm:gap-2">
              <button
                ref={playButtonRef}
                type="button"
                onClick={(e) => { if (e.detail <= 1) start(false, true); }}
                aria-label="Play the demo video (muted)"
                className={`inline-flex items-center gap-1.5 sm:gap-3 rounded-full bg-gradient-to-r px-3 py-1.5 sm:px-6 sm:py-3 text-sm sm:text-lg font-semibold text-white shadow-2xl ring-white/80 transition-all hover:scale-105 hover:from-terracotta-600 hover:to-terracotta-700 hover:ring-4 ${frameHover ? 'scale-105 from-terracotta-600 to-terracotta-700 ring-4' : 'from-terracotta-500 to-terracotta-600 ring-0'} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-terracotta-600`}
              >
                <FaPlay aria-hidden="true" />
                Play
              </button>
              <button
                type="button"
                onClick={(e) => { if (e.detail <= 1) start(true, true); }}
                aria-label="Play the demo video with sound"
                className="inline-flex min-h-6 items-center gap-1.5 sm:gap-2 rounded-full bg-white/90 px-2.5 py-1 sm:px-4 sm:py-1.5 text-[11px] sm:text-sm font-medium text-warm-gray-900 shadow-lg transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-warm-gray-900"
              >
                <FaVolumeHigh aria-hidden="true" />
                Play with sound
              </button>
            </div>
          </div>
        ) : (
          <>
            {buffering && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
                <span className="h-10 w-10 sm:h-12 sm:w-12 animate-spin rounded-full border-4 border-white/40 border-t-white" aria-hidden="true" />
                <span className="sr-only">Loading video</span>
              </div>
            )}
            <button
              ref={pauseButtonRef}
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
