
import { FC } from 'react'
import { Box, ChakraProvider, Flex, VStack, Button } from '@chakra-ui/react'
import * as React from 'react';
interface contextMenuProps {
    x: Number
    y: Number
    closeContextMenu: () => void;
    inputButtons: () => void;
    buttonState: Number;
}
const ContextMenus: FC<contextMenuProps> = ({ x, y, closeContextMenu, inputButtons, buttonState }) => {
    window.onclick = function (e) {
        if (!document.getElementById("overallBox")?.contains(e.target) || e.target === !document.getElementById("overallBox")) {
            closeContextMenu()
        } else {

        }
        console.log(e.target)
    }
    return (
        <VStack id="overallBox" zIndex="20" position="absolute" top={y + "px"} left={x + "px"} w="100" spacing="0px">
            <Button w="100%" h="50%">
                <Flex bg="white" fontSize={"100%"} fontFamily={"sans-serif"} textColor="darkgrey" flexGrow={1}>Delete (uncoded)</Flex>
            </Button>
            <Button w="100%" h="50%" onClick={inputButtons} >
                <Flex bg="white" fontSize={"100%"} fontFamily={"sans-serif"} textColor="darkgrey" flexGrow={1}>{(buttonState === 2) ? "Remove Descriptors" : "Add Descriptors"}</Flex>
            </Button>
        </VStack >
    )
}

export default ContextMenus;