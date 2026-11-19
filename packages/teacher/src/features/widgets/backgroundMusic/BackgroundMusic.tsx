import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaForwardStep } from 'react-icons/fa6';
import { useWidgetState } from '@shared/hooks/useWidgetState';
import { cn, buttons, text, widgetContainer, widgetWrapper } from '@shared/utils/styles';
import { useAudioVolumeStore } from '../../../store/audioVolumeStore';
import { PlayPauseButton, WidgetControlBar } from '../shared/components';
import { getMood, moods, type MoodId } from './moods';

// How long one track fades into the next.
const CROSSFADE_SECONDS = 6;

interface BackgroundMusicState {
  mood: MoodId;
}

interface BackgroundMusicProps {
  savedState?: BackgroundMusicState;
  onStateChange?: (state: BackgroundMusicState) => void;
}

function BackgroundMusic({ savedState, onStateChange }: BackgroundMusicProps) {
  const { state, updateState } = useWidgetState<BackgroundMusicState>({
    initialState: { mood: 'chill' },
    savedState,
    onStateChange
  });
  const mood = getMood(state.mood);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const masterVolume = useAudioVolumeStore((volumeState) => volumeState.volume);

  // Two players: near the end of a track the next one starts on the idle
  // player and fades in while the current one fades out, so a mood plays
  // without gaps for as long as it is left on.
  const playersRef = useRef<HTMLAudioElement[]>([]);
  const activeRef = useRef(0);
  // Each player's crossfade gain, applied on top of the app volume.
  const fadesRef = useRef([1, 1]);
  // The crossfade under way: the player fading out, and the timer driving
  // the fade once the incoming track has actually started.
  const crossfadeRef = useRef<{ outgoing: number; timer: number | null } | null>(null);
  // Bumped by every play or pause, so a late play() result from an earlier
  // action cannot undo a newer one.
  const playIdRef = useRef(0);
  // The mood whose track is loaded in the active player, so Play resumes it.
  const loadedMoodRef = useRef<MoodId | null>(null);

  const setFade = useCallback((player: number, fade: number) => {
    fadesRef.current[player] = fade;
    const audio = playersRef.current[player];
    if (audio) audio.volume = useAudioVolumeStore.getState().volume * fade;
  }, []);

  // Ends a crossfade at once: the incoming track carries on at full volume.
  const finishCrossfade = useCallback(() => {
    const crossfade = crossfadeRef.current;
    if (crossfade === null) return;
    if (crossfade.timer !== null) window.clearInterval(crossfade.timer);
    crossfadeRef.current = null;
    playersRef.current[crossfade.outgoing]?.pause();
    setFade(activeRef.current, 1);
  }, [setFade]);

  const playTrack = useCallback((moodId: MoodId, index: number, crossfade = false) => {
    const tracks = getMood(moodId).tracks;
    finishCrossfade();
    const playId = ++playIdRef.current;
    const outgoing = activeRef.current;
    const player = crossfade ? 1 - outgoing : outgoing;
    const audio = playersRef.current[player] ?? (playersRef.current[player] = new Audio());
    const following = (index + 1) % tracks.length;
    // The idle player usually has this track loaded already (see below).
    if (audio.getAttribute('src') === tracks[index].src) {
      audio.currentTime = 0;
    } else {
      audio.src = tracks[index].src;
    }
    // Play the mood's tracks in turn, looping back to the first. A paused
    // player still reports a final timeupdate, which must not start the next.
    audio.ontimeupdate = () => {
      if (activeRef.current === player && !audio.paused && crossfadeRef.current === null
        && audio.duration - audio.currentTime <= CROSSFADE_SECONDS) {
        playTrack(moodId, following, true);
      }
    };
    // Fallback for a track too short or unloaded to report its duration.
    audio.onended = () => {
      if (activeRef.current === player && crossfadeRef.current === null) playTrack(moodId, following);
    };
    activeRef.current = player;
    const fade = crossfade ? { outgoing, timer: null as number | null } : null;
    crossfadeRef.current = fade;
    setFade(player, crossfade ? 0 : 1);
    loadedMoodRef.current = moodId;
    setTrackIndex(index);
    setIsPlaying(true);
    audio.play().then(() => {
      // Fade only once the incoming track is audible, so a slow load leaves
      // the outgoing track playing rather than fading into silence.
      if (!fade || crossfadeRef.current !== fade) return;
      const previous = playersRef.current[outgoing];
      // If loading took longer than the outgoing track had left, there is
      // nothing to fade from: bring the new track straight in.
      if (previous.ended) {
        finishCrossfade();
        return;
      }
      const length = Math.min(CROSSFADE_SECONDS, Math.max(0.5, previous.duration - previous.currentTime || 0));
      const startedAt = performance.now();
      // Wall-clock progress, so a throttled background timer only makes the
      // steps coarser, never the fade longer.
      fade.timer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / (length * 1000));
        if (progress >= 1) {
          finishCrossfade();
          return;
        }
        // Equal-power curves keep the overall loudness steady mid-fade.
        setFade(player, Math.sin(progress * Math.PI / 2));
        setFade(outgoing, Math.cos(progress * Math.PI / 2));
      }, 50);
    }, (error: unknown) => {
      if (playIdRef.current !== playId || (error as Error)?.name === 'AbortError') return;
      if (fade && crossfadeRef.current === fade) {
        // The incoming track could not start: Safari refuses a player no click
        // has unlocked, or the track failed to load. Let this track finish and
        // try the next one on this player; if that fails too, playback stops.
        crossfadeRef.current = null;
        activeRef.current = outgoing;
        // A crossfade always moves to the following track, so this one is still playing.
        setTrackIndex((index + tracks.length - 1) % tracks.length);
        const previous = playersRef.current[outgoing];
        previous.ontimeupdate = null;
        // It may already have ended while the incoming play() was pending.
        if (previous.ended) playTrack(moodId, index);
        else previous.onended = () => playTrack(moodId, index);
        return;
      }
      setIsPlaying(false);
    });
    // Safari lets a media element play only after a click has played it, so
    // play the idle player silently while this call may still be inside one.
    // It also loads the next track well before the crossfade needs it.
    if (!crossfade) {
      const idle = 1 - player;
      const next = playersRef.current[idle] ?? (playersRef.current[idle] = new Audio());
      next.src = tracks[following].src;
      next.muted = true;
      next.play().then(() => {
        if (activeRef.current !== idle) next.pause();
      }, () => undefined).finally(() => { next.muted = false; });
    }
  }, [finishCrossfade, setFade]);

  // Follow mood changes, whether from the selector or a restored board.
  useEffect(() => {
    if (loadedMoodRef.current === null || loadedMoodRef.current === state.mood) return;
    const active = playersRef.current[activeRef.current];
    if (active && !active.paused) {
      playTrack(state.mood, 0);
    } else {
      loadedMoodRef.current = null;
      setTrackIndex(0);
    }
  }, [state.mood, playTrack]);

  useEffect(() => {
    playersRef.current.forEach((audio, player) => {
      audio.volume = masterVolume * fadesRef.current[player];
    });
  }, [masterVolume]);

  useEffect(() => () => {
    const timer = crossfadeRef.current?.timer;
    if (timer != null) window.clearInterval(timer);
    for (const audio of playersRef.current) {
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, []);

  const togglePlay = useCallback(() => {
    const audio = playersRef.current[activeRef.current];
    if (isPlaying) {
      playIdRef.current++;
      finishCrossfade();
      audio?.pause();
      setIsPlaying(false);
    } else if (audio && loadedMoodRef.current === state.mood) {
      const playId = ++playIdRef.current;
      setIsPlaying(true);
      audio.play().catch(() => {
        if (playIdRef.current === playId) setIsPlaying(false);
      });
    } else {
      playTrack(state.mood, trackIndex);
    }
  }, [finishCrossfade, isPlaying, playTrack, state.mood, trackIndex]);

  const track = mood.tracks[trackIndex] ?? mood.tracks[0];

  return (
    <div className={widgetWrapper}>
      <div className={cn(widgetContainer, 'p-3 gap-3')}>
        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0" role="group" aria-label="Music mood">
          {moods.map(({ id, label, description, icon: Icon, selectedClass }) => {
            const selected = id === state.mood;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => updateState({ mood: id })}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 transition-colors duration-150 min-h-0',
                  selected
                    ? selectedClass
                    : 'bg-white/45 border-warm-gray-300 text-warm-gray-700 hover:bg-white/80 dark:bg-warm-gray-800/45 dark:border-warm-gray-600 dark:text-warm-gray-200 dark:hover:bg-warm-gray-700'
                )}
              >
                <Icon className="text-xl shrink-0" aria-hidden="true" />
                <span className="text-sm font-semibold leading-tight">{label}</span>
                <span className={cn('text-xs leading-tight', selected ? 'text-white/85' : text.muted)}>
                  {description}
                </span>
              </button>
            );
          })}
        </div>
        <p className={cn('text-xs text-center truncate', text.secondary)} title="CC0 public domain music from FreePD.com">
          {isPlaying ? 'Now playing: ' : 'Up next: '}
          <span className="font-medium">{track.title}</span> · {track.artist}
        </p>
      </div>
      <WidgetControlBar justify="justify-center">
        <PlayPauseButton isActive={isPlaying} onToggle={togglePlay} activeLabel="Pause" inactiveLabel="Play" />
        <button
          type="button"
          onClick={() => playTrack(state.mood, (trackIndex + 1) % mood.tracks.length)}
          className={cn(buttons.secondary, 'px-3 py-1.5 text-sm flex items-center gap-1.5')}
          title="Next track"
        >
          <FaForwardStep className="text-xs" aria-hidden="true" />
          <span>Next</span>
        </button>
      </WidgetControlBar>
    </div>
  );
}

export default BackgroundMusic;
