// Copyright 2023 The MediaPipe Authors.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//      http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;
const demosSection = document.getElementById("demos");
const imageBlendShapes = document.getElementById("image-blend-shapes");
const videoBlendShapes = document.getElementById("video-blend-shapes");
let faceLandmarker;
let runningMode = "IMAGE";
let eyeColor = '#FF3030'; // Initial color, will be updated based on background
let lastBlinkTimestamp = 0;
let isMuted = false; // Global mute state
let eyesClosed = false; // false indicates eyes are open
let blinkRegistered = false; // Track if a blink has been registered
let dotColor = 'black';
let userToggledFacialLandmarks = false; // Initialize the variable
let enableWebcamButton;
let webcamRunning = false;
let headlines = []; // Array to store fetched headlines
let currentHeadlineIndex = 0; // Index of the current headline
const videoWidth = 1080;

// New variable to keep track of whether to show the facial diagram
let showFacialDiagram = true;

let synth;
let reverb;
let synthReady = false;


// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
async function createFaceLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode,
        numFaces: 1
    });
    demosSection.classList.remove("invisible");
}



function toggleFacialLandmarks() {
    const outputCanvas = document.getElementById("output_canvas");
    outputCanvas.style.display = outputCanvas.style.display === "none" ? "block" : "none";
    userToggledFacialLandmarks = true; // User has toggled the visibility
}

fetchNYTimesHeadlines();
// toggleFacialLandmarks();
createFaceLandmarker();
// Function to toggle the display of the facial diagram
function toggleFacialDiagram() {
    const outputCanvas = document.getElementById("output_canvas");
    outputCanvas.style.display = outputCanvas.style.display === "none" ? "block" : "none";
    
    // Update the text content of the "showHideText" element
    const showHideText = document.getElementById("showHideText");
    showHideText.textContent = outputCanvas.style.display === "none" ? "Show Diagram" : "Hide Diagram";
}

// Add a click event listener to the "showHideText" element
const showHideText = document.getElementById("showHideText");
showHideText.addEventListener("click", () => {
    toggleFacialDiagram();
});

// Initialize the visibility of the facial diagram (optional)
// toggleFacialDiagram();





const imageContainers = document.getElementsByClassName("detectOnClick");
// Now let's go through all of these and add a click event listener.
for (let imageContainer of imageContainers) {
    // Add event listener to the child element whichis the img element.
    imageContainer.children[0].addEventListener("click", handleClick);
}
// When an image is clicked, let's detect it and display results!
async function handleClick(event) {
    if (!faceLandmarker) {
        console.log("Wait for faceLandmarker to load before clicking!");
        return;
    }
    if (runningMode === "VIDEO") {
        runningMode = "IMAGE";
        await faceLandmarker.setOptions({ runningMode });
    }
    // Remove all landmarks drawed before
    const allCanvas = event.target.parentNode.getElementsByClassName("canvas");
    for (var i = allCanvas.length - 1; i >= 0; i--) {
        const n = allCanvas[i];
        n.parentNode.removeChild(n);
    }

}

// Function to fetch New York Times headlines
async function fetchNYTimesHeadlines() {
    const apiKey = 'n7F1g2jSF17lzYqzPa7W8mqpbyVRKEql'; // Replace with your New York Times API key
    try {
        const response = await fetch(`https://api.nytimes.com/svc/topstories/v2/home.json?api-key=${apiKey}`);
        const data = await response.json();
        headlines = data.results.map(result => {
            console.log("Headline:", result.title);
            let imageUrl = null;
            if (result.multimedia && result.multimedia.length) {
                imageUrl = result.multimedia[0].url;
                console.log("Image URL:", imageUrl);
            } else {
                console.log("No image available for this headline.");
            }
            return { title: result.title, imageUrl: imageUrl };
        });
    } catch (error) {
        console.error('Error fetching headlines:', error);
    }
}

let isFirstHeadlineShown = false; // Initialize the variable
function displayNextHeadline() {
    // Check if there are any headlines
    if (headlines.length === 0) {
        const headlineElement = document.getElementById("headline");
        headlineElement.textContent = "No headlines available";
        return;
    }

    // Get the headline element and the current headline
    const headlineElement = document.getElementById("headline");
    const currentHeadline = headlines[currentHeadlineIndex];

    // Update the headline text
    headlineElement.textContent = currentHeadline.title;

    // Log the image URL associated with the current headline, if available
    if (currentHeadline.imageUrl) {
        console.log(`Image URL for '${currentHeadline.title}': ${currentHeadline.imageUrl}`);
    } else {
        console.log(`No image available for '${currentHeadline.title}'.`);
    }

    // Hide the facial diagram only after displaying the first headline
    if (!isFirstHeadlineShown) {
        output_canvas.style.display = 'none';
        isFirstHeadlineShown = true; // Update the flag
    }
    // Move to the next headline, looping back to the start if at the end
    currentHeadlineIndex = (currentHeadlineIndex + 1) % headlines.length;

    // Remove the centered-large-canvas class from the canvas when a headline is displayed
    const canvasElement = document.getElementById("output_canvas");
    if (canvasElement.classList.contains("centered-large-canvas")) {
        canvasElement.classList.remove("centered-large-canvas");
    }
}



/********************************************************************
// Face detection and landmark detection on webcam
********************************************************************/
const video = document.getElementById("webcam");

const canvasElement = document.getElementById("output_canvas");
canvasElement.width = canvasElement.offsetWidth;
canvasElement.height = canvasElement.offsetHeight;

const canvasCtx = canvasElement.getContext("2d");
// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}


function enableCam() {
    if (!faceLandmarker) {
        console.log("Wait! faceLandmarker not loaded yet.");
        return;
    }

    // Check and resume the Tone.js audio context
    if (Tone.context.state !== 'running') {
        Tone.context.resume().then(() => {
            console.log('Audio context running');
            initializeSynthAndEffects();
        }).catch(error => {
            console.error('Error resuming audio context:', error);
        });
    } else {
        // Initialize the synth if the context is already running
        initializeSynthAndEffects();
    }

    // getUserMedia parameters with facingMode
    const constraints = {
        video: {
            facingMode: "user" // Prefers the front-facing camera on mobile devices
        }
    };

    // Activate the webcam stream
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        const video = document.getElementById('webcam');
        video.srcObject = stream;
        video.addEventListener('loadeddata', predictWebcam);

        // Hide the welcome screen and show the main content
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');

        // Remove the centered-large-canvas class from the canvas
        const canvasElement = document.getElementById("output_canvas");
        canvasElement.classList.remove("centered-large-canvas");

    }).catch((error) => {
        console.error('Error accessing the webcam:', error);
    });
}

  


document.addEventListener('DOMContentLoaded', () => {
    // Add the 'centered-large-canvas' class to the 'output_canvas' element
    const canvasElement = document.getElementById("output_canvas");


    const welcomeText = document.getElementById('welcomeText');
    if (welcomeText) {
        welcomeText.addEventListener('click', () => {
            const canvasElement = document.getElementById("output_canvas");
            canvasElement.classList.add("centered-canvas");
    
            // Call enableCam or any other function you need to run here
            enableCam();
        });
    }

    // Other initialization code can go here, if needed
});



let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

async function predictWebcam() {
    const aspectRatio = video.videoHeight / video.videoWidth;
    video.style.width = videoWidth + "px";
    video.style.height = videoWidth * aspectRatio + "px";

    // Adjust canvas size based on device pixel ratio for better resolution
    const pixelRatio = window.devicePixelRatio || 1;
    canvasElement.width = videoWidth * pixelRatio;
    canvasElement.height = (videoWidth * aspectRatio) * pixelRatio;
    canvasElement.style.width = videoWidth + "px";
    canvasElement.style.height = videoWidth * aspectRatio + "px";
    canvasCtx.scale(pixelRatio, pixelRatio);

    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await faceLandmarker.setOptions({ runningMode: runningMode });
    }

    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = await faceLandmarker.detectForVideo(video, startTimeMs);
    }

    if (results && results.faceLandmarks) {
        canvasCtx.save();
        canvasCtx.translate(canvasElement.width / pixelRatio, 0);
        canvasCtx.scale(-1, 1);

        const dotSize = 5; // Adjust dot size for visibility

        for (const landmarks of results.faceLandmarks) {
            canvasCtx.fillStyle = dotColor; // Use the global dot color variable
            landmarks.forEach(point => {
                const x = point.x * canvasElement.width / pixelRatio;
                const y = point.y * canvasElement.height / pixelRatio;
                canvasCtx.beginPath();
                canvasCtx.arc(x, y, dotSize, 0, 2 * Math.PI);
                canvasCtx.fill();
            });
        }

        canvasCtx.restore();
    }

    drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
    window.requestAnimationFrame(predictWebcam);
}




//inversion and dark mode
let lastBlinkTime = 0;
const blinkDebounceTime = 20; // 1 second debounce time
let isBackgroundBlack = true; // initial background color state

function toggleBackgroundColor() {
    const body = document.body;
    const infoIcon = document.getElementById('infoIconLink'); // Make sure your image has this ID

    if (isBackgroundBlack) {
        body.style.backgroundColor = 'white';
        headline.style.color = 'black';
        dotColor = 'black'; // Update dot color
        infoIcon.style.filter = 'invert(0%)'; // No inversion for light mode
        muteButton.style.filter = 'invert(0%)'; // No inversion for light mode
        showHideText.style.filter = 'invert(0%)'; // No inversion for light mode

    } 
    
    else {
        body.style.backgroundColor = 'black';
        headline.style.color = 'white';
        dotColor = 'white'; // Update dot color
        infoIcon.style.filter = 'invert(100%)'; // Invert colors for dark mode
        muteButton.style.filter = 'invert(100%)'; // No inversion for light mode
        showHideText.style.filter = 'invert(100%)'; // No inversion for light mode

    }
    isBackgroundBlack = !isBackgroundBlack;
}
// Mute button event listener
const muteButton = document.getElementById('muteButton');
muteButton.addEventListener('click', () => {
    isMuted = !isMuted;
    Tone.Master.mute = isMuted;
    muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
});

// Function to map time duration to volume
function mapDurationToVolume(duration) {
    const maxVolume = -5; // A reasonable maximum volume in dB
    const minVolume = -30; // Minimum volume in dB
    const maxDuration = 5000; // Maximum duration in milliseconds (e.g., 5 seconds)

    const clampedDuration = Math.min(duration, maxDuration);

    // Map duration to volume (linear scaling)
    const volume = minVolume + ((maxVolume - minVolume) * (clampedDuration / maxDuration));
    return volume;
}

function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) {
        return;
    }

    let isCurrentlyClosed = false;
    const currentTime = Date.now();

    blendShapes[0].categories.forEach((shape) => {
        if ((shape.categoryName === 'eyeBlinkLeft' || shape.categoryName === 'eyeBlinkRight') && shape.score > 0.6) {
            isCurrentlyClosed = true;
        }
    });

    // If eyes just closed and a blink hasn't been registered yet
    if (isCurrentlyClosed && !eyesClosed && !blinkRegistered) {
        if (currentTime - lastBlinkTime > blinkDebounceTime) {
            console.log(`Eye Blink Detected`);
            processBlink(currentTime);
        }
        eyesClosed = true;
        blinkRegistered = true; // Mark that a blink has been registered
    } else if (!isCurrentlyClosed) {
        eyesClosed = false;
        blinkRegistered = false; // Reset when eyes are opened
    }

    el.innerHTML = ''; // Clear the blend shapes list
}

function processBlink(currentTime) {
    // Only adjust volume if not muted
    if (!isMuted) {
        if (lastBlinkTimestamp !== 0) {
            const timeSinceLastBlink = currentTime - lastBlinkTimestamp;
            console.log(`Milliseconds since last blink: ${timeSinceLastBlink}`);

            // Calculate the new volume based on time since last blink
            const newVolume = mapDurationToVolume(timeSinceLastBlink);
            Tone.Master.volume.value = newVolume; // Adjust the master volume
            console.log(`Master volume set to: ${newVolume} dB`);
        }
    }

    lastBlinkTimestamp = currentTime; // Update the last blink timestamp
    toggleBackgroundColor(); // Toggle the background color
    displayNextHeadline();    // Display the next headline
    lastBlinkTime = currentTime; // Update the last blink time
    playRandomFrequency(); // Play a random frequency
}


let harshNoiseSynth;

function initializeSynthAndEffects() {
  if (Tone.context.state !== 'running') {
    console.error('Audio context is not running');
    return;
  }

  // Existing Synth
  synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
  });

  // Harsh Noise Synth
  harshNoiseSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 1 }
  });

  reverb = new Tone.Reverb({ decay: 5, wet: 0.75 });
  synth.toDestination(); // Ensure the synth is connected to the destination

  // Chain both synths to the reverb and then to the destination
  synth.chain(reverb, Tone.Destination);
  harshNoiseSynth.chain(reverb, Tone.Destination);
  synthReady = true;
  console.log('Synthesizers and reverb initialized');

}

function changeMasterVolume(newVolume) {
    Tone.Master.volume.value = newVolume; // newVolume should be in dB
}

let filter = new Tone.Filter(800, "lowpass").toDestination();

// Inside initializeSynthAndEffects
harshNoiseSynth.connect(filter);


  function playRandomFrequency() {
    if (!synthReady && !isMuted) {
      console.warn('Synthesizer is not ready.');
      return;
    }
  
    const randomFreq = Math.random() * (18000 - 20) + 800; // Random frequency between 20 Hz and 20,000 Hz
    synth.triggerAttackRelease(randomFreq, "16n");
    harshNoiseSynth.triggerAttackRelease('16n');

  }