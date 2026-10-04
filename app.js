const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const memeImage = document.getElementById('meme_image');

const memes = {
    default: 'memes/default.png',
    fist: 'memes/fist.png',
    shaka: 'memes/shaka.png',
    chill: 'memes/chill.png',
    glasses: 'memes/glasses.png',
    shhh: 'memes/shhh.png',
    grab: 'memes/grab.png'
};

// Змінна для збереження координат обличчя
let currentFaceLandmarks = null;

function calcDistance(p1, p2, width, height) {
    const x1 = p1.x * width, y1 = p1.y * height;
    const x2 = p2.x * width, y2 = p2.y * height;
    return Math.hypot(x2 - x1, y2 - y1);
}

function isFist(landmarks) {
    const tips = [8, 12, 16, 20], joints = [6, 10, 14, 18];
    let curled = 0;
    for (let i = 0; i < 4; i++) {
        if (landmarks[tips[i]].y > landmarks[joints[i]].y) curled++;
    }
    return curled === 4;
}

function isShaka(landmarks) {
    return landmarks[4].y < landmarks[3].y && 
           landmarks[20].y < landmarks[18].y && 
           landmarks[8].y > landmarks[6].y && 
           landmarks[12].y > landmarks[10].y && 
           landmarks[16].y > landmarks[14].y;
}

function isPointerUp(landmarks) {
    return landmarks[8].y < landmarks[6].y && 
           landmarks[12].y > landmarks[10].y && 
           landmarks[16].y > landmarks[14].y && 
           landmarks[20].y > landmarks[18].y;
}

function isHandsBehindHead(multiHandLandmarks) {
    if (multiHandLandmarks.length < 2) return false;
    return multiHandLandmarks[0][0].y < 0.5 && multiHandLandmarks[1][0].y < 0.5;
}

function onResultsHands(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let currentMeme = memes.default;
    const w = canvasElement.width;
    const h = canvasElement.height;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (isHandsBehindHead(results.multiHandLandmarks)) {
            currentMeme = memes.chill;
        } else {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});
                
                if (isFist(landmarks)) {
                    currentMeme = memes.fist;
                } else if (isShaka(landmarks)) {
                    currentMeme = memes.shaka;
                } else if (isPointerUp(landmarks)) {
                    currentMeme = memes.glasses;
                    if (currentFaceLandmarks) {
                        const dist = calcDistance(landmarks[8], currentFaceLandmarks[14], w, h);
                        if (dist < 80) currentMeme = memes.shhh;
                    }
                } else {
                    if (currentFaceLandmarks) {
                        const distPalm = calcDistance(landmarks[9], currentFaceLandmarks[14], w, h);
                        if (distPalm < 120) currentMeme = memes.grab;
                    }
                }
            }
        }
    }
    memeImage.src = currentMeme;
    canvasCtx.restore();
}

// Ініціалізація Face Mesh
const faceMesh = new FaceMesh({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});
faceMesh.setOptions({maxNumFaces: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7});
faceMesh.onResults((results) => {
    currentFaceLandmarks = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0 
        ? results.multiFaceLandmarks[0] 
        : null;
});

// Ініціалізація Hands
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7});
hands.onResults(onResultsHands);

// Запуск камери (передаємо кадри обом нейромережам)
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({image: videoElement});
        await hands.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start();