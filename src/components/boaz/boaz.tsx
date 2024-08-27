import { Box, ChakraProvider, Flex, Image, Input, Stack } from '@chakra-ui/react'
import { Rnd } from 'react-rnd'
import shh from './Be-quiet-now.png'
import shhimg from './Silence-image.png'
import whisp from './Whisper-with-text.png'
import whispimg from './Whisper.png'
import yap from './yap-with-text.png'
import yapimg from './yap.png'
import neighbour from './Discuss-with-neighbour-with-text.png'
import neighbourimg from './Discuss.png'
import * as React from 'react';
import { useState, useCallback } from 'react'
function Boaz() {
    const [borderW, setBorder] = useState("2px");
    const [index, change] = useState(0);
    const img = [shh, whisp, yap, neighbour];
    const [displayState, setDisplay] = useState('flex')
    const ping = require('./discord-ping.mp3')


    function plaey() {
        new Audio(ping).play();
    }
    window.onclick = function (e) {
        if (e.target === document.getElementById("widget1") || e.target === document.getElementById("widget1big")) {
            setBorder("2px")
            setDisplay("flex");
        } else if (e.target.parentNode === document.getElementById("widget1inside")) {
            setBorder("2px")
            setDisplay("flex");
            plaey();
        } else {
            setBorder("0px")
            setDisplay("none");
        }
        console.log(e.target)
    }

    return (
        <div>
            <Rnd id="widget1big" default={{
                x: -400,
                y: -400,
                width: '200px',
                height: '250px',
            }} minWidth='125px' lockAspectRatio={true}>
                <ChakraProvider>
                    <Box
                        id="widget1" padding="5%" borderWidth={borderW} borderColor={"skyblue"}>

                        <Box pointerEvents="none" display='flex' marginBottom="5%" borderRadius='10%' userSelect={"none"} w="100%" h="80%" background={'white'}>
                            <Image pointerEvents="none" draggable="false" userSelect={"none"} id="mainimg" src={img[index]}>
                            </Image>
                        </Box>
                        <Box id="widget1inside" w="20%" display={displayState} alignItems='baseline'>
                            <Image draggable="false" userSelect={"none"} marginLeft="12.5%" marginRight={"12.5%"} borderRadius='full' onClick={() => change(0)} src={shhimg}>
                            </Image>
                            <Image draggable="false" userSelect={"none"} marginLeft="12.5%" marginRight={"12.5%"} borderRadius='full' backgroundColor={'white'} onClick={() => change(1)} src={whispimg}>
                            </Image>
                            <Image draggable="false" userSelect={"none"} marginLeft="12.5%" marginRight={"12.5%"} borderRadius='full' backgroundColor={'white'} onClick={() => change(2)} src={neighbourimg}>
                            </Image>
                            <Image draggable="false" userSelect={"none"} marginLeft="12.5%" marginRight={"12.5%"} borderRadius='full' backgroundColor={'white'} onClick={() => change(3)} src={yapimg}>
                            </Image>
                        </Box>
                    </Box>
                </ChakraProvider>
            </Rnd>
        </div >
    )
}
export default Boaz;