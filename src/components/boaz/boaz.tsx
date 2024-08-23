import { Box, ChakraProvider, Flex, Image, Stack } from '@chakra-ui/react'
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
    const [activeLight, setActiveLight] = useState('red');
    const [boxWidth, setBoxWidth] = useState(100);

    // Handlers for each light click
    const handleRedClick = () => {
        setActiveLight('red');
        alert('Red light clicked!');
    };

    const handleYellowClick = () => {
        setActiveLight('yellow');
        alert('Yellow light clicked!');
    };

    const handleGreenClick = () => {
        setActiveLight('green');
        alert('Green light clicked!');
    };



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
    const boxRef = useCallback((node) => {
        if (node !== null) {
            setBoxWidth(node.getBoundingClientRect().height * 0.4);
            console.log("bruh this sucks");
            const resizeObserver2 = new ResizeObserver(() => {
                console.log(node.getBoundingClientRect().height * 0.4);
                setBoxWidth(node.getBoundingClientRect().height * 0.4);
            });
            resizeObserver2.observe(node);
        }
    }, []);
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
            <Rnd default={{
                x: 0,
                y: 0,
                width: '100px',
                height: '250px',

            }} ref={boxRef}>
                <Stack direction='row' width='100%' height='100%' bg="white"
                >
                    <Box id="boxlol"
                        width={boxWidth + 'px'}
                        height='100%'
                        bg="grey"
                        borderRadius="10px"
                    >
                        <Stack direction={['column']} align="center" h="100%" w='100%' spacing="0px" >
                            {/* Red Light */}
                            <Box
                                width="50%"
                                height="20%"
                                borderRadius="100%"
                                bg='red'
                                filter='auto'
                                brightness={(activeLight === 'red') ? '200%' : '50%'}
                                cursor="pointer"
                                onClick={handleRedClick}
                                margin="12.5%"
                                marginTop="25%"
                            ></Box>
                            {/* Yellow Light */}
                            <Box
                                width="50%"
                                height="20%"
                                borderRadius="100%"
                                bg='yellow'
                                filter='auto'
                                brightness={(activeLight === 'yellow') ? '200%' : '50%'}
                                cursor="pointer"
                                onClick={handleYellowClick}
                                margin="12.5%"
                            ></Box>
                            {/* Green Light */}
                            <Box
                                width="50%"
                                height="20%"
                                borderRadius="100%"
                                bg='green'
                                filter='auto'
                                brightness={(activeLight === 'green') ? '200%' : '50%'}
                                cursor="pointer"
                                onClick={handleGreenClick}
                                margin="12.5%"
                                marginBottom="25%"
                            ></Box>
                        </Stack>
                    </Box>
                    <p>eeeeeeeeeeeeeeeeeeeeee</p>

                </Stack>

            </Rnd>
        </div >
    )
}
export default Boaz;