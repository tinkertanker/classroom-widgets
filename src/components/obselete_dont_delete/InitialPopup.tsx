import React, { useEffect, useState } from 'react';
import {
    Button,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    Kbd
} from '@chakra-ui/react';

const InitialPopup: React.FC = () => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);

    useEffect(() => {
        if (isFirstLoad) {
            onOpen();
            setIsFirstLoad(false);
        }
    }, [isFirstLoad, onOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Welcome!</ModalHeader>
                <ModalCloseButton />
                <ModalBody paddingBottom={"10%"}>
                    Press <Kbd>Ctrl</Kbd> + <Kbd>k</Kbd> to open the drawer.
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default InitialPopup;
