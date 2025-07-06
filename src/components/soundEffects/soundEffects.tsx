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

// Sound file imports - uncomment when files are added
const victorySound = require("./sounds/victory.mp3");
const wrongSound = require("./sounds/wrong.mp3");
const attentionSound = require("./sounds/attention.mp3");
const questionSound = require("./sounds/question.mp3");
const timesUpSound = require("./sounds/times-up.mp3");
const goodTrySound = require("./sounds/good-try.mp3");
const quietSound = require("./sounds/quiet.mp3");
const transitionSound = require("./sounds/transition.mp3");
const drumrollSound = require("./sounds/drumroll.mp3");
const applauseSound = require("./sounds/applause.mp3");

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
    { name: 'Victory', icon: FaTrophy, color: 'bg-sage-500 hover:bg-sage-600', soundFile: victorySound },
    { name: 'Wrong', icon: FaXmark, color: 'bg-dusty-rose-500 hover:bg-dusty-rose-600', soundFile: wrongSound },
    { name: 'Attention', icon: FaBell, color: 'bg-terracotta-500 hover:bg-terracotta-600', soundFile: attentionSound  },
    { name: 'Question', icon: FaQuestion, color: 'bg-sage-600 hover:bg-sage-700', soundFile: questionSound },
    { name: "Time's Up", icon: FaClock, color: 'bg-terracotta-600 hover:bg-terracotta-700', soundFile: timesUpSound },
    { name: 'Good Try', icon: FaThumbsUp, color: 'bg-sage-400 hover:bg-sage-500', soundFile: goodTrySound },
    { name: 'Quiet', icon: FaVolumeXmark, color: 'bg-warm-gray-600 hover:bg-warm-gray-700', soundFile: quietSound },
    { name: 'Transition', icon: FaArrowRightArrowLeft, color: 'bg-terracotta-400 hover:bg-terracotta-500', soundFile: transitionSound },
    { name: 'Drumroll', icon: FaDrum, color: 'bg-terracotta-500 hover:bg-terracotta-600', soundFile: drumrollSound },
    { name: 'Applause', icon: FaHandsClapping, color: 'bg-sage-500 hover:bg-sage-600', soundFile: applauseSound },
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
        console.error(`Error playing ${soundName} sound:`, error);
      });
    } else {
      // Fallback for when sound files aren't loaded yet
      console.log(`Sound file not loaded for: ${soundName}`);
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
    <div className="w-full h-full bg-soft-white dark:bg-warm-gray-800 rounded-lg shadow-sm border border-warm-gray-200 dark:border-warm-gray-700 p-2 overflow-y-auto">
      <div className="flex flex-col gap-1 h-full">
        {soundButtons.map((sound, index) => {
          const Icon = sound.icon as React.ComponentType<{ className?: string }>;
          const keyNumber = index < 9 ? (index + 1).toString() : '0';
          return (
            <button
              key={sound.name}
              id={`sound-${sound.name}`}
              onClick={() => playSound(sound.name)}
              className={`${sound.color} text-white rounded-md py-2 px-1.5 flex items-center justify-center gap-1.5 transition-all duration-150 transform active:scale-95 shadow-sm`}
              title={`${sound.name} (Press ${keyNumber})`}
            >
              <Icon className="w-5 h-5" />
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
  );
};

export default SoundEffects;