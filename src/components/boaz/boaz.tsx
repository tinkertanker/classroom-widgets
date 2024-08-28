import { useState, useCallback, useEffect } from 'react';
import * as React from 'react'
import { Card, Box, Image, CardFooter, CardHeader } from '@chakra-ui/react';
import shh from './Be-quiet-now.png';
import shhimg from './Silence-image.png';
import whisp from './Whisper-with-text.png';
import whispimg from './Whisper.png';
import yap from './yap-with-text.png';
import yapimg from './yap.png';
import neighbour from './Discuss-with-neighbour-with-text.png';
import neighbourimg from './Discuss.png';

function Boaz() {
    const [state, setState] = useState({
        borderW: "2px",
        index: 0,
        clicked: true,
    });

    const images = [
        { main: shh, thumbnail: shhimg },
        { main: whisp, thumbnail: whispimg },
        { main: yap, thumbnail: yapimg },
        { main: neighbour, thumbnail: neighbourimg },
    ];

    const ping = require('./discord-ping.mp3');

    const plaey = useCallback(() => {
        new Audio(ping).play();
    }, [ping]);

    const handleClick = useCallback((e) => {
        if (e.target.closest("#widget1")) {
            setState(prev => ({
                ...prev,
                borderW: "2px",
                clicked: true,
            }));
            if (e.target.closest("#widget1inside")) {
                plaey();
            }
        } else {
            setState(prev => ({
                ...prev,
                borderW: "0px",
                clicked: false,
            }));
        }
    }, [plaey]);

    const handleChangeImage = useCallback((index) => {
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
        <div>
            <Card width='400px' height='500px' minWidth='125px' id="widget1">
                <Box padding="5%" borderWidth={state.borderW} borderColor={"skyblue"}>
                    <CardHeader>
                        <Box
                            alignItems="center"
                            pointerEvents="none"
                            display='flex'
                            marginBottom="5%"
                            borderRadius='10%'
                            userSelect={"none"}
                            w="100%"
                            h={(state.borderW === "0px") ? "100%" : "80%"}
                            background={'white'}
                        >
                            <Image
                                pointerEvents="none"
                                draggable="false"
                                userSelect={"none"}
                                id="mainimg"
                                src={images[state.index].main}
                            />
                        </Box>
                    </CardHeader>
                    {state.clicked && (
                        <CardFooter display="flex">
                            <Box id="widget1inside" w="20%" display="flex" alignItems='baseline'>
                                {images.map((image, i) => (
                                    <Image
                                        key={i}
                                        draggable="false"
                                        userSelect={"none"}
                                        marginLeft="12.5%"
                                        marginRight={"12.5%"}
                                        borderRadius='full'
                                        backgroundColor={'white'}
                                        onClick={() => handleChangeImage(i)}
                                        src={image.thumbnail}
                                    />
                                ))}
                            </Box>
                        </CardFooter>
                    )}
                </Box>
            </Card>
        </div>
    );
}

export default Boaz;
