import React, { useEffect, useState } from 'react';
// @ts-ignore
import { 
  FaTrophy,        // Victory
  FaXmark,         // Wrong (X icon)
  FaBell,          // Attention
  FaQuestion,      // Question
  FaClock,         // Time's Up
  FaThumbsUp,      // Good Try
  FaVolumeXmark,   // Quiet (mute icon)
  FaArrowRightArrowLeft, // Transition
  FaDrum,          // Drumroll
  FaHandsClapping  // Applause
} from 'react-icons/fa6';
import { IconType } from 'react-icons';

// Sound file imports
import victorySoundFile from "./sounds/victory.mp3";
import wrongSoundFile from "./sounds/wrong.mp3";
import attentionSoundFile from "./sounds/attention.mp3";
import questionSoundFile from "./sounds/question.mp3";
import timesUpSoundFile from "./sounds/times-up.mp3";
import goodTrySoundFile from "./sounds/good-try.mp3";
import quietSoundFile from "./sounds/quiet.mp3";
import transitionSoundFile from "./sounds/transition.mp3";
import drumrollSoundFile from "./sounds/drumroll.mp3";
import applauseSoundFile from "./sounds/applause.mp3";

interface SoundButton {
  name: string;
  icon: IconType;
  color: string;
  soundFile?: string;
}

interface SoundEffectsProps {
  isActive?: boolean;
}

const SoundEffects: React.FC<SoundEffectsProps> = ({ isActive = false }) => {
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  // Sound effect definitions with our color palette
  const soundButtons: SoundButton[] = [
    { name: 'Victory', icon: FaTrophy, color: 'bg-sage-500 hover:bg-sage-600', soundFile: victorySoundFile },
    { name: 'Wrong', icon: FaXmark, color: 'bg-dusty-rose-500 hover:bg-dusty-rose-600', soundFile: wrongSoundFile },
    { name: 'Attention', icon: FaBell, color: 'bg-terracotta-500 hover:bg-terracotta-600', soundFile: attentionSoundFile  },
    { name: 'Question', icon: FaQuestion, color: 'bg-sage-600 hover:bg-sage-700', soundFile: questionSoundFile },
    { name: "Time's Up", icon: FaClock, color: 'bg-terracotta-600 hover:bg-terracotta-700', soundFile: timesUpSoundFile },
    { name: 'Good Try', icon: FaThumbsUp, color: 'bg-sage-400 hover:bg-sage-500', soundFile: goodTrySoundFile },
    { name: 'Quiet', icon: FaVolumeXmark, color: 'bg-warm-gray-600 hover:bg-warm-gray-700', soundFile: quietSoundFile },
    { name: 'Transition', icon: FaArrowRightArrowLeft, color: 'bg-terracotta-400 hover:bg-terracotta-500', soundFile: transitionSoundFile },
    { name: 'Drumroll', icon: FaDrum, color: 'bg-terracotta-500 hover:bg-terracotta-600', soundFile: drumrollSoundFile },
    { name: 'Applause', icon: FaHandsClapping, color: 'bg-sage-500 hover:bg-sage-600', soundFile: applauseSoundFile },
  ];

  // Initialize audio elements when sound files are available
  useEffect(() => {
    const audioMap = new Map<string, HTMLAudioElement>();
    
    soundButtons.forEach(button => {
      if (button.soundFile) {
        const audio = new Audio(button.soundFile);
        audio.preload = 'auto';
        audioMap.set(button.name, audio);
      }
    });

    setAudioElements(audioMap);

    // Cleanup
    return () => {
      audioMap.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  // Keyboard shortcuts (1-9 for first 9 sounds, 0 for 10th sound)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if it's a number key (1-9 or 0)
      const key = e.key;
      let index = -1;
      
      if (key >= '1' && key <= '9') {
        index = parseInt(key) - 1;
      } else if (key === '0') {
        index = 9; // 0 key represents the 10th sound
      }
      
      // Also support numpad keys
      if (e.code.startsWith('Numpad')) {
        const numpadKey = e.code.replace('Numpad', '');
        if (numpadKey >= '1' && numpadKey <= '9') {
          index = parseInt(numpadKey) - 1;
        } else if (numpadKey === '0') {
          index = 9;
        }
      }
      
      // Play the sound if valid index
      if (index >= 0 && index < soundButtons.length) {
        e.preventDefault();
        playSound(soundButtons[index].name);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive, soundButtons, audioElements]);

  const playSound = (soundName: string) => {
    // Play the sound if available
    const audio = audioElements.get(soundName);
    if (audio) {
      // Reset and play
      audio.currentTime = 0;
      audio.play().catch(error => {
        // Error playing sound
      });
    } else {
      // Fallback for when sound files aren't loaded yet
    }
    
    // Visual feedback - button press animation
    const button = document.getElementById(`sound-${soundName}`);
    if (button) {
      button.classList.add('scale-95');
      setTimeout(() => {
        button.classList.remove('scale-95');
      }, 100);
    }
  };

  return (
    <div className="w-full h-full bg-soft-white/90 dark:bg-warm-gray-800/90 rounded-lg border border-warm-gray-200 dark:border-warm-gray-700 flex flex-col">
      {/* Drag handle area */}
      <div className="sound-effects-drag-handle px-2 py-2 border-b border-warm-gray-200 dark:border-warm-gray-700 cursor-move hover:bg-warm-gray-100 dark:hover:bg-warm-gray-700 transition-colors duration-200 group">
        <div className="flex justify-center">
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-1.5 group-hover:gap-2 transition-all duration-200">
              <div className="w-1 h-1 bg-warm-gray-400 dark:bg-warm-gray-500 rounded-full group-hover:bg-warm-gray-500 dark:group-hover:bg-warm-gray-400"></div>
              <div className="w-1 h-1 bg-warm-gray-400 dark:bg-warm-gray-500 rounded-full group-hover:bg-warm-gray-500 dark:group-hover:bg-warm-gray-400"></div>
              <div className="w-1 h-1 bg-warm-gray-400 dark:bg-warm-gray-500 rounded-full group-hover:bg-warm-gray-500 dark:group-hover:bg-warm-gray-400"></div>
            </div>
            <div className="flex gap-1.5 group-hover:gap-2 transition-all duration-200">
              <div className="w-1 h-1 bg-warm-gray-400 dark:bg-warm-gray-500 rounded-full group-hover:bg-warm-gray-500 dark:group-hover:bg-warm-gray-400"></div>
              <div className="w-1 h-1 bg-warm-gray-400 dark:bg-warm-gray-500 rounded-full group-hover:bg-warm-gray-500 dark:group-hover:bg-warm-gray-400"></div>
              <div className="w-1 h-1 bg-warm-gray-400 dark:bg-warm-gray-500 rounded-full group-hover:bg-warm-gray-500 dark:group-hover:bg-warm-gray-400"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sound buttons */}
      <div className="flex-1 p-2 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-1">
          {soundButtons.map((sound, index) => {
          const Icon = sound.icon as React.ComponentType<{ className?: string }>;
          const keyNumber = index < 9 ? (index + 1).toString() : '0';
          return (
            <button
              key={sound.name}
              id={`sound-${sound.name}`}
              onClick={(_e) => {
                playSound(sound.name);
              }}
              className={`${sound.color} text-white rounded-md py-2 px-1.5 flex items-center justify-center gap-1.5 transition-all duration-150 transform active:scale-95 shadow-sm`}
              title={`${sound.name} (Press ${keyNumber})`}
            >
              <Icon className="w-4 h-4" />
              {isActive && (
                <span className="text-xs opacity-70 font-mono">
                  {keyNumber}
                </span>
              )}
            </button>
          );
          })}
        </div>
      </div>
    </div>
  );
};

export default SoundEffects;