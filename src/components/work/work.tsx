import { useState, useCallback, useEffect } from 'react';
import * as React from 'react'
import { Card, Box, Image, CardFooter, CardHeader, flexbox, Img } from '@chakra-ui/react';
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
        <Card width="100%" height="100%" id="widget1">
            <CardHeader height={"60%"} display={"flex"} justifyContent={"center"} flexDirection={"row"} flexShrink={1} minWidth={0}>
                <Box
                    pointerEvents="none"
                    borderRadius='10%'
                    userSelect={"none"}
                    background={'white'}
                    height="100%"
                >
                    <Image
                        height="100%"
                        pointerEvents="none"
                        draggable="false"
                        userSelect={"none"}
                        id="mainimg"
                        src={images[state.index].main}
                    />
                </Box>
            </CardHeader>
            {state.clicked && (
                <CardFooter display="flex" h="30%">
                    <Box id="widget1inside" justifyContent="space-evenly" height="100%" display="flex">
                        {images.map((image, i) => (
                            <Image
                                key={i}
                                draggable="false"
                                userSelect="none"
                                borderRadius='full'
                                backgroundColor='white'
                                onClick={() => handleChangeImage(i)}
                                src={image.thumbnail}
                            />
                        ))}
                    </Box>
                </CardFooter>
            )}
        </Card >
    );
}

export default Work;
