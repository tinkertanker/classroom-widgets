import { useState, useCallback, useEffect } from 'react';
import * as React from 'react'
// Removed Chakra UI imports
import shh from './Be-quiet-now.png';
import shhimg from './Silence-image.png';
import whisp from './Whisper-with-text.png';
import whispimg from './Whisper.png';
import yap from './yap-with-text.png';
import yapimg from './yap.png';
import neighbour from './Discuss-with-neighbour-with-text.png';
import neighbourimg from './Discuss.png';

function Work() {
    const [state, setState] = useState({
        borderW: "2px",
        index: 0,
        clicked: true,
    });

    const images = [
        { main: shh, thumbnail: shhimg },
        { main: whisp, thumbnail: whispimg },
        { main: neighbour, thumbnail: neighbourimg },
        { main: yap, thumbnail: yapimg },
    ];

    const ping = require('./woosh-230554.mp3');

    const plaey = useCallback(() => {
        new Audio(ping).play();
    }, [ping]);

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
        <div className="bg-white rounded-lg shadow-md w-full h-full" id="widget1">
            <div className="h-[60%] flex justify-center flex-row flex-shrink min-w-0 p-4">
                <div
                    className="pointer-events-none rounded-[10%] select-none bg-white h-full"
                >
                    <img
                        className="h-full pointer-events-none select-none"
                        draggable="false"
                        id="mainimg"
                        src={images[state.index].main}
                        alt="Work mode"
                    />
                </div>
            </div>
            {state.clicked && (
                <div className="flex h-[30%] p-4">
                    <div id="widget1inside" className="flex justify-evenly h-full w-full">
                        {images.map((image, i) => (
                            <img
                                key={i}
                                draggable="false"
                                className="select-none rounded-full bg-white cursor-pointer h-full"
                                onClick={() => handleChangeImage(i)}
                                src={image.thumbnail}
                                alt={`Option ${i + 1}`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Work;
