import { ChakraProvider } from '@chakra-ui/react'
import { Card, CardHeader, CardBody, CardFooter, Text } from '@chakra-ui/react'



function Jason() {
    return (
        <ChakraProvider>
            <Card>
                <CardBody>
                    <Text>test component</Text>
                </CardBody>
            </Card>
        </ChakraProvider>

    )
}

export default Jason