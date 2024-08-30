import {
    Box, Flex, Input, Stack, Card
} from '@chakra-ui/react';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ContextMenus from './contextMenu.tsx';

function TrafficLight() {
    const [state, setState] = useState({
        activeLight: 'red',
        boxWidth: 100,
        contextMenu: { show: false, x: 0, y: 0 },
        num: 0
    });

    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (boxRef.current) {
            const node = boxRef.current;
            const resizeObserver = new ResizeObserver(() => {
                const newWidth = Math.round(node.getBoundingClientRect().height / 5 * 2);
                setState(prevState => ({
                    ...prevState,
                    boxWidth: newWidth
                }));
            });

            // Set initial box width
            setState(prevState => ({
                ...prevState,
                boxWidth: Math.round(node.getBoundingClientRect().height / 5 * 2)
            }));

            resizeObserver.observe(node);

            return () => {
                resizeObserver.disconnect();
            };
        }
    }, []); // Empty dependency array ensures this runs only once when the component mounts

    const handleContextMenu = useCallback((e) => {
        const target = e.target.closest("#baller");
        if (target) {
            const { pageX, pageY } = e;
            e.preventDefault();
            setState(prevState => ({
                ...prevState,
                contextMenu: { show: true, x: pageX, y: pageY }
            }));
        }
    }, []);

    useEffect(() => {
        window.addEventListener("contextmenu", handleContextMenu);

        return () => {
            window.removeEventListener("contextmenu", handleContextMenu);
        };
    }, [handleContextMenu]);

    const closeContextMenu = useCallback(() => {
        setState(prevState => ({
            ...prevState,
            contextMenu: { show: false, x: 0, y: 0 }
        }));
    }, []);

    const handleLightClick = useCallback((color) => {
        setState(prevState => ({
            ...prevState,
            activeLight: color
        }));
    }, []);

    const toggleInputButtons = useCallback(() => {
        setState(prevState => ({
            ...prevState,
            num: prevState.num === 0 ? 2 : 0
        }));
    }, []);

    return (
        <Card
            width="100%"
            height="100%"
            id="baller"
        >
            {state.contextMenu.show &&
                <ContextMenus
                    x={state.contextMenu.x}
                    y={state.contextMenu.y}
                    closeContextMenu={closeContextMenu}
                    inputButtons={toggleInputButtons}
                    buttonState={state.num}
                />
            }
            <Stack
                borderRadius="10px"
                direction='row'
                width='100%'
                height='100%'
                bg="white"
                ref={boxRef}
                spacing="0px">
                <Box
                    display={"flex"}
                    id="boxlol"

                    maxW={`${state.boxWidth}px`}
                    height='100%'
                    bg="darkslategrey"
                    borderRadius="10px"
                    flexGrow={1}
                    flexShrink={1}
                >
                    <Stack direction='column' align="center" h="100%" w='100%' spacing="0px">
                        {['red', 'yellow', 'green'].map((color, index) => (
                            <Box
                                key={color}
                                width="50%"
                                height="20%"
                                borderRadius="100%"
                                bg={color}
                                filter='auto'
                                brightness={state.activeLight === color ? '200%' : '30%'}
                                cursor="pointer"
                                onClick={() => handleLightClick(color)}
                                margin="12.5%"
                                marginTop={index === 0 ? '25%' : '12.5%'}
                                marginBottom={index === 2 ? '25%' : '12.5%'}
                            ></Box>
                        ))}
                    </Stack>
                </Box>
                <Flex id="balls" flexDirection="column" bg='white' height='100%' justifyContent="space-evenly" flexGrow={1}>
                    {[...Array(3)].map((_, i) => (
                        <Input
                            key={i}
                            height="33.33%"
                            placeholder='...'
                            width='auto'
                            textColor="black"
                            variant='filled'
                        />
                    ))}
                </Flex>
            </Stack>
        </Card>
    );
}

export default TrafficLight;
