import { useState, useCallback, useEffect } from 'react';
import * as React from 'react'
import { 
  FaVolumeXmark,     // Silence
  FaVolumeLow,       // Whisper
  FaComments,        // Ask Neighbour
  FaPeopleGroup      // Work Together
} from 'react-icons/fa6';

function Work() {
    const [state, setState] = useState({
        borderW: "2px",
        index: 0,
        clicked: true,
    });

    const workModes = [
        { icon: FaVolumeXmark, label: 'Silence', color: 'text-red-500' },
        { icon: FaVolumeLow, label: 'Whisper', color: 'text-orange-500' },
        { icon: FaComments, label: 'Ask Neighbour', color: 'text-blue-500' },
        { icon: FaPeopleGroup, label: 'Work Together', color: 'text-green-500' },
    ];

    const actionClickSound = require('../../sounds/action_click.mp3');

    const plaey = useCallback(() => {
        new Audio(actionClickSound).play();
    }, [actionClickSound]);

    const handleClick = useCallback((e) => {
        if (e.target.closest("#widget1")) {
            setState(prev => ({
                ...prev,
                clicked: true,
            }));
            if (e.target.closest("#widget1inside")) {
                plaey();
            }
        }
    }, [plaey]);

    const handleChangeImage = useCallback((index: number) => {
        setState(prev => ({
            ...prev,
            index,
        }));
    }, []);

    useEffect(() => {
        window.addEventListener("click", handleClick);
        return () => {
            window.removeEventListener("click", handleClick);
        };
    }, [handleClick]);

    return (
        <div className="bg-transparent rounded-lg w-full h-full flex flex-col" id="widget1">
            <div className="flex-1 flex flex-col justify-center items-center p-4">
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    {React.createElement(workModes[state.index].icon, {
                        className: `w-2/3 h-2/3 ${workModes[state.index].color}`,
                        style: { maxWidth: '200px', maxHeight: '200px' }
                    })}
                    <h2 className={`text-2xl font-bold ${workModes[state.index].color}`}>
                        {workModes[state.index].label}
                    </h2>
                </div>
            </div>
            {state.clicked && (
                <div className="p-4">
                    <div id="widget1inside" className="flex justify-center gap-1">
                        {workModes.map((mode, i) => {
                            const Icon = mode.icon;
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleChangeImage(i)}
                                    className={`p-3 rounded-lg transition-all duration-200 ${
                                        state.index === i 
                                            ? 'bg-warm-gray-200 shadow-inner' 
                                            : 'bg-warm-gray-100 hover:bg-warm-gray-200'
                                    }`}
                                >
                                    <Icon className="w-6 h-6 text-warm-gray-700" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Work;
