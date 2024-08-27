import {
    Box, ChakraProvider, Flex, Image, Input, Menu,
    MenuButton,
    MenuList,
    MenuItem,
    MenuItemOption,
    MenuGroup,
    MenuOptionGroup,
    MenuDivider, Stack
} from '@chakra-ui/react'
import { Rnd } from 'react-rnd'
import * as React from 'react';
import { useState, useCallback } from 'react'
import ContextMenus from './contextMenu.tsx';
function TrafficLight() {
    const [activeLight, setActiveLight] = useState('red');
    const [boxWidth, setBoxWidth] = useState(100);
    const [coords, setCoords] = useState({ x: 0, y: 0 })
    const [num, setnum] = useState(0);
    const initialContextMenu = {
        show: false,
        x: 0,
        y: 0,
    }
    const [contextMenu, setContextMenu] = useState(initialContextMenu)
    const boxRef = useCallback((node) => {
        if (node !== null) {
            setBoxWidth(Math.round(node.getBoundingClientRect().height) / 5 * 2);
            console.log("bruh this sucks");
            const resizeObserver2 = new ResizeObserver(() => {
                console.log(Math.round(node.getBoundingClientRect().height / 5 * 2));
                setBoxWidth(Math.round(node.getBoundingClientRect().height) / 5 * 2);
            });
            resizeObserver2.observe(node);
        }
    }, []);

    window.oncontextmenu = function (e) {
        if (document.getElementById("baller")?.contains(e.target)) {
            const { pageX, pageY } = e;
            e.preventDefault()
            return (
                setContextMenu({ show: true, x: pageX, y: pageY })
            )
        } else {

        }
        console.log(e.target)
    }
    // Handlers for each light click
    const handleRedClick = () => {
        setActiveLight('red');
    };

    const handleYellowClick = () => {
        setActiveLight('yellow');
    };

    const handleGreenClick = () => {
        setActiveLight('green');
    };
    const closeContextMenu = () => { setContextMenu(initialContextMenu) }

    function inputButtons() {
        if (num === 0) {
            setnum(2)
        }
        if (num === 2) {
            setnum(0)
        }
    }
    
    return (
        <div>
            {contextMenu.show && <ContextMenus x={contextMenu.x} y={contextMenu.y} closeContextMenu={closeContextMenu} inputButtons={inputButtons} buttonState={num} />}
            <Rnd default={{
                x: 0,
                y: 0,
                width: '300px',
                height: '250px',
            }} id="baller" minWidth={boxWidth + "px"} maxWidth={(num !== 2) ? boxWidth + "px" : window.innerWidth + "px"}>
                <Stack borderRadius={"10px"} direction='row' width='100%' height='100%' bg="white" ref={boxRef} spacing="0px" >
                    <Box id="boxlol"
                        width={boxWidth + 'px'}
                        height='100%'
                        bg="darkslategrey"
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
                    <Flex id="balls" flexDirection="column" bg='white' height='100%' justifyContent={"space-evenly"} width="0%" flexGrow={1}>
                        <Input height="33.33%" placeholder='...' width='auto' textColor={"black"} variant='filled'>

                        </Input>

                        <Input height="33.34%" placeholder='...' width='auto' textColor={"black"} variant='filled'>
                        </Input>
                        <Input height="33.33%" placeholder='...' width='auto' textColor={"black"} variant='filled'>

                        </Input>
                    </Flex>
                </Stack>
            </Rnd >
        </div>
        
    )
}
export default TrafficLight;