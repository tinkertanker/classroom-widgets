import { ChakraProvider, VStack } from '@chakra-ui/react'
import { Card, CardHeader, CardBody, CardFooter, Text, Button, Textarea } from '@chakra-ui/react'
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
    PopoverHeader,
    PopoverBody,
    PopoverArrow,
    PopoverCloseButton,
    PopoverAnchor, Portal
} from '@chakra-ui/react';
import { Fade, ScaleFade, Slide, SlideFade, Collapse } from '@chakra-ui/react';
import { useDisclosure } from '@chakra-ui/react';
import { useState } from 'react';
import * as React from 'react'

let list = [];


function Jason() {
    const initialFocusRef = React.useRef()
    const [result, setResult] = useState("Type a list to randomise!");
    const [open, setOpen] = useState(true);

    // let { isOpen } = useDisclosure()

    // isOpen = true;
    const handleClick = () => {
        if (list.length !== 0) {
            for (let j = 0;j<=list.length;j++){

                setTimeout(function(){
                    if (j!== list.length) {

                        setOpen(false);
                        setTimeout(function(){
                            setResult(list[j]);
                            setOpen(true);
                            console.log(list[j]);
                        },200)
                        
                    }else{
                        setOpen(false);
                        setTimeout(function(){
                            setResult(list[Math.floor(Math.random() * list.length)]);
                            setOpen(true);
                        },200)
                    }

                },(400*j))

            }
        } else {
            setResult("Nothing to randomise!");
            setTimeout(function (){
                setResult("Type a list to randomise!")
            },2000)
            
        }

    }
    const handleList = (event) => {
        let input_string = event.target.value;
        list = input_string.split("\n");
        console.log(list);

    }
    return (
        <ChakraProvider>
            <Card size="lg" colorScheme='pink' width='90vw'>
                <CardBody>
                    <VStack>
                        <Popover initialFocusRef={initialFocusRef} >
                        {/* {({ isOpen }) => ( */}
                            <>
                            <PopoverTrigger>
                                {/* <Button>{isOpen ? 'Close Input':result}</Button> */}
                                <Button>
                                    <SlideFade in={open} offsetY='20px'>
                                        <Text>
                                            {result}
                                        </Text>
                                    </SlideFade>
                                </Button>
                            </PopoverTrigger>

                            
                            <Portal placement='top'>
                                <PopoverContent>
                                    <PopoverArrow />
                                    <PopoverHeader>Type the list of entries to randomise!</PopoverHeader>
                                    <PopoverCloseButton />

                                    <PopoverBody>
                                        <Textarea onChange={handleList} ref={initialFocusRef}></Textarea>
                                    </PopoverBody>
                                </PopoverContent>
                            </Portal>
                            </>
                        {/* )} */}
                        </Popover>
                        <Button colorScheme='teal' size='lg' onClick={handleClick}>
                            Randomise!!
                        </Button>

                    </VStack>
                </CardBody>
            </Card>
        </ChakraProvider>

    )
}

export default Jason