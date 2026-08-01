import { useCallback, useEffect, useState } from 'react';
import * as React from 'react'
// @ts-ignore
import { 
  FaVolumeXmark,     // Silence
  FaVolumeLow,       // Whisper
  FaComments,        // Discuss with neighbour
  FaUser,            // Work alone
  FaPeopleGroup,     // Work together
  FaMugHot,          // Break time
  FaBroom            // Clean up
} from 'react-icons/fa6';
import changeSoundFile from './change.wav';

interface TaskCueProps {
    isActive?: boolean;
    savedState?: { index: number };
    onStateChange?: (state: { index: number }) => void;
}

function TaskCue({ isActive = false, savedState, onStateChange }: TaskCueProps) {
    const [selectedIndex, setSelectedIndex] = useState(savedState?.index ?? 0);

    const taskModes = [
        { icon: FaVolumeXmark, label: 'Silence', color: 'text-dusty-rose-500' },
        { icon: FaVolumeLow, label: 'Whisper', color: 'text-terracotta-500' },
        { icon: FaComments, label: 'Discuss with neighbour', color: 'text-sage-600' },
        { icon: FaUser, label: 'Work alone', color: 'text-warm-gray-700' },
        { icon: FaPeopleGroup, label: 'Work together', color: 'text-terracotta-600' },
        { icon: FaMugHot, label: 'Break time', color: 'text-sage-500' },
        { icon: FaBroom, label: 'Clean up', color: 'text-dusty-rose-600' },
    ];

    const plaey = useCallback(() => {
        new Audio(changeSoundFile).play();
    }, []);

    const handleClick = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("#widget1inside")) {
            plaey();
        }
    }, [plaey]);

    const handleChangeImage = useCallback((index: number) => {
        setSelectedIndex(index);
        onStateChange?.({ index });
    }, [onStateChange]);

    const handleNextState = useCallback(() => {
        const index = (selectedIndex + 1) % taskModes.length;
        setSelectedIndex(index);
        onStateChange?.({ index });
        plaey();
    }, [selectedIndex, taskModes.length, onStateChange, plaey]);

    useEffect(() => {
        if (savedState?.index !== undefined) {
            setSelectedIndex(savedState.index);
        }
    }, [savedState?.index]);

    useEffect(() => {
        window.addEventListener("click", handleClick);
        return () => {
            window.removeEventListener("click", handleClick);
        };
    }, [handleClick]);

    return (
        <div className="w-full h-full overflow-hidden flex flex-col rounded-lg" id="widget1">
            <div className="flex-1 flex flex-col justify-center items-center px-3 pt-3">
                <div 
                    className="clickable w-full h-full flex flex-col items-center justify-center space-y-4 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={handleNextState}
                    title="Click to cycle to next state"
                >
                    {React.createElement(taskModes[selectedIndex].icon as any, {
                        className: `w-2/3 h-2/3 ${taskModes[selectedIndex].color}`,
                        style: { maxWidth: '200px', maxHeight: '200px' }
                    })}
                    <h2 className={`text-2xl font-bold ${taskModes[selectedIndex].color}`}>
                        {taskModes[selectedIndex].label}
                    </h2>
                </div>
            </div>
            {isActive && (
                <div className="px-3 pb-3">
                    <div id="widget1inside" className="flex flex-wrap justify-center gap-1">
                        {taskModes.map((mode, i) => {
                            const Icon = mode.icon;
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleChangeImage(i)}
                                    className={`p-2 rounded-lg transition-all duration-200 ${
                                        selectedIndex === i
                                            ? 'bg-warm-gray-200 dark:bg-warm-gray-700 shadow-inner' 
                                            : 'bg-warm-gray-100 dark:bg-warm-gray-800 hover:bg-warm-gray-200 dark:hover:bg-warm-gray-700'
                                    }`}
                                    title={mode.label}
                                >
                                    {React.createElement(Icon as any, { className: "w-5 h-5 text-warm-gray-700 dark:text-warm-gray-300" })}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TaskCue;
