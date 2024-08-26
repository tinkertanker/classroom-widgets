import * as React from "react";
import { ChakraProvider } from "@chakra-ui/react";

import * as faceapi from "face-api.js";
await faceapi.nets.ssdMobilenetv1.loadFromUri("models/");
await faceapi.nets.faceLandmark68Net.loadFromUri("models/");
await faceapi.nets.faceLandmark68TinyNet.loadFromUri("models/");
await faceapi.nets.ageGenderNet.loadFromUri("models/");

function Face() {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  React.useEffect(() => {
    const detectFaces = async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const input = videoRef.current;
          const canvas = document.getElementById("overlay") as HTMLCanvasElement;
      
          try {
            const results = await faceapi
              .detectAllFaces(input)
              .withFaceLandmarks()
              .withAgeAndGender();
      
      
            faceapi.matchDimensions(canvas, input);
            const resizedResults = faceapi.resizeResults(results, input);
      
            // Clear the canvas before drawing new detections
            const context = canvas.getContext("2d");
            context?.clearRect(0, 0, canvas.width, canvas.height);
      
            resizedResults.forEach((result) => {
              const { box } = result.detection;
              const mirroredBox = new faceapi.draw.DrawBox(
                new faceapi.Rect(canvas.width - box.right, box.top, box.width, box.height),
                { label: result.detection.score.toFixed(2) }
              );
              mirroredBox.draw(canvas);
            });
      
            resizedResults.forEach((result) => {
              const { age, gender, genderProbability } = result;
              const { box } = result.detection;
      
              // Calculate the mirrored position for the text
              const textPosition = {
                x: canvas.width - box.right,
                y: box.bottom,
              };
      
              new faceapi.draw.DrawTextField(
                [`${faceapi.utils.round(age, 0)} years`, `${gender} (${faceapi.utils.round(genderProbability)})`],
                textPosition
              ).draw(canvas);
            });
          } catch (error) {
            console.error("Error detecting faces:", error);
          }
        }
      };

    const intervalId = setInterval(detectFaces, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);
  //   React.useEffect(() => {
  //     const detectFaces = async () => {
  //       if (input instanceof HTMLVideoElement) {
  //         console.log("hi");
  //         try {
  //           const detections = await faceapi.detectAllFaces(input);

  //           console.log("Face detections:", detections);
  //           console.log("joi");
  //         } catch (error) {
  //           console.error("Error detecting faces:", error);
  //         }
  //         console.log("after");
  //       } else {
  //         console.error("Input is not a valid video element");
  //       }
  //     };
  //     console.log(input);
  //     if (input != null) {
  //       detectFaces();
  //     } else {
  //       input = document.getElementById("video");
  //     }
  //   }, [input]);

  return (
    <ChakraProvider>
      <div  className="margin">
        <video
          ref={videoRef}
          autoPlay
          id="video"
          style={{ transform: "scaleX(-1)",position: "absolute" }}
          width='640px'
          height='480px'
        />
        <canvas id="overlay" style={{ position: "relative" }} />
      </div>
    </ChakraProvider>
  );
}

export default Face;
