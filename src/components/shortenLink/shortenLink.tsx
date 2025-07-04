import React, { useState } from 'react';
import axios from 'axios';
import QRCode from 'react-qr-code';
// Removed Chakra UI imports
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
    <div
      className="w-full h-full border border-gray-200 rounded-lg overflow-hidden p-4 shadow-md bg-white"
    >
      <div className="flex flex-col space-y-4 items-center">
        <h2 className="text-black text-lg font-semibold">Shorten Your Link</h2>
        <input
          placeholder="Enter your link here"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button onClick={handleShortenLink} className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded transition-colors duration-200">
          Shorten Link
        </button>

        {error && <p className="text-red-500">{error}</p>} {/* Display error message if exists */}

        {shortenedLink && (
          <div
            className="flex flex-grow flex-row w-full justify-evenly items-center text-center"
          >
            <div className="text-blue-500">
              <p className="text-black">Your Shortened Link:</p>
              <a href={shortenedLink} target="_blank" rel="noopener noreferrer">
                {shortenedLink}
              </a>
            </div>
            <div className="flex justify-center mt-2 w-32">
              <QRCode value={qrCodeValue} size={128} /> {/* QR code with 128px size */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShortenLink;
