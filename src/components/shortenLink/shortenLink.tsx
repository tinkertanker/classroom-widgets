import React, { useState } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
import { Box, Button, Input, Stack, Text, Heading, Flex } from '@chakra-ui/react'; // Import necessary Chakra UI components
import { API_KEY, BASE_URL } from '../../secrets/shortioKey.example.js'; // Import your API key securely from secrets

const ShortenLink: React.FC = () => {
  const [link, setLink] = useState<string>(''); // State for the original link input
  const [shortenedLink, setShortenedLink] = useState<string>(''); // State for the shortened link
  const [qrCodeValue, setQrCodeValue] = useState<string>(''); // State for the QR code value
  const [error, setError] = useState<string | null>(null); // State for any errors

  // Function to handle link shortening
  const handleShortenLink = async () => {
    try {
      // Send POST request to Short.io API
      const response = await axios.post(
        BASE_URL,
        {
          originalURL: link,
          domain: "tk.sg" // Replace with your domain or remove if not needed
        },
        {
          headers: {
            authorization: API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('API Response:', response.data);

      // Check the response and set shortened link and QR code
      if (response.data && response.data.secureShortURL) {
        setShortenedLink(response.data.secureShortURL);
        setQrCodeValue(response.data.secureShortURL);
        setError(null); // Clear any previous errors
      } else if (response.data && response.data.shortURL) {
        setShortenedLink(response.data.shortURL);
        setQrCodeValue(response.data.shortURL);
        setError(null); // Clear any previous errors
      } else {
        setError('Shortening the link failed. No valid URL received.');
      }
    } catch (err) {
      console.error('Error shortening the link:', err);
      setError('An error occurred while shortening the link. Please try again.');
    }
  };

  return (
    <Box
      width="100%"
      height="100%"
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      p="4"
      boxShadow="md"
      bg="white"
    >
      <Stack spacing={4} align="center"> {/* Reduced the spacing to 4 */}
        <Heading textColor="black" size="md">Shorten Your Link</Heading> {/* Heading component for the title */}
        <Input
          placeholder="Enter your link here"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          textColor={"black"}
        />
        <Button onClick={handleShortenLink} colorScheme="teal" width="full">
          Shorten Link
        </Button>

        {error && <Text color="red.500">{error}</Text>} {/* Display error message if exists */}

        {shortenedLink && (
          <Box
            display="flex"
            flexGrow={1}
            flexDirection={"row"}
            width="100%"
            justifyContent="space-evenly"
            alignItems={"center"}
            textAlign="center"
          >
            <Text color="blue.500">
              <Text textColor={"black"}>Your Shortened Link:</Text>
              <a href={shortenedLink} target="_blank" rel="noopener noreferrer">
                {shortenedLink}
              </a>
            </Text>
            <Flex justifyContent={"center"} mt={2} width="128px">
              <QRCode value={qrCodeValue} size={128} /> {/* QR code with 128px size */}
            </Flex>
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default ShortenLink;
