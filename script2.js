let results = undefined;
const videoBlendShapes = document.getElementById("video-blend-shapes");

import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
const { FaceLandmarker, FilesetResolver } = vision;
let runningMode = "VIDEO";

let faceLandmarker;
const videoWidth = 1080;
const dotColor = "black"; // Initial color for dots
let lastVideoTime = -1;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

document.addEventListener("DOMContentLoaded", async () => {
  await createFaceLandmarker();
  enableCam();
});

async function createFaceLandmarker() {
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU",
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1,
  });
}

function enableCam() {
  const constraints = {
    video: {
      facingMode: "user",
    },
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    })
    .catch((error) => {
      console.error("Error accessing the webcam:", error);
    });
}

async function predictWebcam() {
  const aspectRatio = video.videoHeight / video.videoWidth;
  video.style.width = videoWidth + "px";
  video.style.height = videoWidth * aspectRatio + "px";

  // Adjust canvas size based on device pixel ratio for better resolution
  const pixelRatio = window.devicePixelRatio || 1;
  canvasElement.width = videoWidth * pixelRatio;
  canvasElement.height = videoWidth * aspectRatio * pixelRatio;
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
      landmarks.forEach((point) => {
        const x = (point.x * canvasElement.width) / pixelRatio;
        const y = (point.y * canvasElement.height) / pixelRatio;
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
function drawBlendShapes(el, blendShapes) {
  if (!blendShapes.length) {
    return;
  }

  blendShapes[0].categories.forEach((shape) => {
    const currentTime = Date.now();
  });

  // Remove the part that updates the HTML with the list items
  el.innerHTML = ""; // This line clears the list
}
function drawLandmarks(faceLandmarks, pixelRatio) {
  // Add pixelRatio as a parameter
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.fillStyle = dotColor;

  faceLandmarks.forEach((landmarks) => {
    landmarks.forEach((point) => {
      const x = (point.x * canvasElement.width) / pixelRatio;
      const y = (point.y * canvasElement.height) / pixelRatio;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 10, 0, 2 * Math.PI);
      canvasCtx.fill();
    });
  });
}
function toggleFacialDiagram() {
  const outputCanvas = document.getElementById("output_canvas");
  outputCanvas.style.display =
    outputCanvas.style.display === "none" ? "block" : "none";

  // Update the text content of the "showHideText" element
  const showHideText = document.getElementById("showHideText");
  showHideText.textContent =
    outputCanvas.style.display === "none" ? "Show Diagram" : "Hide Diagram";
}

// Add a click event listener to the "showHideText" element
const showHideText = document.getElementById("showHideText");
showHideText.addEventListener("click", () => {
  toggleFacialDiagram();
});
