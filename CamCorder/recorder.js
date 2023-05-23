let preview = document.getElementById("preview");
let recording = document.getElementById("recording");
let startButton = document.getElementById("startButton");
let stopButton = document.getElementById("stopButton");
let downloadButton = document.getElementById("downloadButton");
let logElement = document.getElementById("log");
let retrieveElement = document.getElementById("retrieveList");

let recordingTimeMS = 3000;
let chunkSizes = []; // global variable holding chunks every 3 sec

// console.log to screen
function log(msg) {
    logElement.innerHTML += `${msg}\n`;
}
// returns a promise of a timer with a time limit
function wait(delayInMS) {
    return new Promise((resolve) => setTimeout(resolve, delayInMS));
}

// Add click event listener to the retrieveElement button
retrieveElement.addEventListener("click", function() {
    // Redirect to the desired URL
    window.location.href = "http://localhost:5500/Server/files/";
  });

function startRecording(stream, lengthInMS, resolution, FrameRate) {
    let [width, height] = resolution.split('x');
    let recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: width * height * 6, //6 bits per pixel
        video: {
            width: { exact: Number(width) },
            height: { exact: Number(height) },
            frameRate: { ideal: FrameRate, max: FrameRate }
        }
    });
    let data = [];
    recorder.ondataavailable = (event) => {
        data.push(event.data); // push into blob every 3 sec
        chunkSizes.push(event.data.size); // push into chunksize the size of every 3 sec inerval
        log(`chunkSizes added value ${event.data.size} bytes of preview Playback`);
        log(`URL saved video of length ${event.data.size} bytes for preview Playback`);
    }
    recorder.start(1000); // start recorder and save into blob every 3 sec

    log(`${recorder.state} for ${lengthInMS / 1000} seconds. with resolution ${resolution} at ${FrameRate} fps`);
    let stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event.name);
    });

// stop if recorder is recording reaches time limit
    let recorded = wait(recordingTimeMS).then(() => {
        if (recorder.state === "recording") {
            recorder.stop();
        }

    });

    return Promise.all([stopped, recorded]).then(() => data);
}

function stop(stream) {
    stream.getTracks().forEach((track) => track.stop());
}

startButton.addEventListener(
    /* Start button is clicked call a req to new MediaStream (Video Only)*/
    "click",
    () => {
        let resolution = "720x480";
        let FrameRate = 30;
        navigator.mediaDevices.getUserMedia({
            video: {
                width: { exact: Number(resolution.split('x')[0]) },
                height: { exact: Number(resolution.split('x')[1]) },
                frameRate: { ideal: FrameRate, max: FrameRate }
            },
            audio: false,
        })
            /* When getUserMedia is resolved the video element preview.srcObject is set 
                to be the input stream 
                NOTE: use download button as trigger to POST           
            */
            .then((stream) => {
                preview.srcObject = stream;
                downloadButton.href = stream;
                preview.captureStream =
                    preview.captureStream || preview.mozCaptureStream; // mozCaptureStream (so this code works on firefox)
                return new Promise((resolve) => (preview.onplaying = resolve));
            })
            /* When video starts to play call startRecording this returns a Promise */
            .then(() =>
                startRecording(preview.captureStream(), recordingTimeMS, resolution, FrameRate)
            )
            /* Promise from startRecording is resolved here receiving chunks of recorded data array as blob chunks*/
            .then((recordedChunks) => {
                let recordedBlob = new Blob(recordedChunks, { type: "video/mp4" }); // Convert blobs into mp4 
                log(`Recorded ${recordedBlob.size} bytes `)
                log(``)
                log(`Size of recordedBlob ${recordedBlob.size}`);

                var promises = [];
                // Split recorded chunks into chunks of 3 seconds
                let chunks = [];
                let StartchunkSizesum = 0;
                let EndchunkSizesum = 0;
                for (let i = 0; i < chunkSizes.length; i++) {
                    EndchunkSizesum += chunkSizes[i];

                    chunks.push(recordedBlob.slice(StartchunkSizesum, EndchunkSizesum, "video/mp4"));

                    // Process chunk after pushing it into chunks as mp4
                    let formData = new FormData();
                    formData.append("file", chunks[i], `chunks-${i}.mp4`);
                    let promise = fetch("http://localhost:8000", {
                        method: "POST",
                        body: formData,
                     }).then((response => {
                        if(!response.ok)
                            throw new Error(`Error uploading chunk ${i + 1}`)
                     }));
                    promises.push(promise);

                    StartchunkSizesum += chunkSizes[i];
                    log(`chunk ${i + 1} size: ${chunks[i].size}`);

                }
                Promise.all(promises).then(() => { 
                        log(`Successfully uploaded total chunks: ${chunks.length}`); 
                    });

                log(`total chunks: ${chunks.length}`);
                let recordingPlayback = new Blob(chunks, { type: "video/mp4" }); // Convert chunks array to blob mp4


                // recording set to recordedBlob for playback as a concatenated array of blob objects
                // in a URL that references this blob
                recording.src = URL.createObjectURL(recordingPlayback);
                downloadButton.href = recording.src; // set download button to URL with blob arr (video in chunks)
                // by setting the attribute to a file named RecordedVideo.mp4
                // the browser is told that at click button should download this file
                // with mp4 content
                downloadButton.download = "RecordedVideo.mp4";

                log(
                    `Successfully recorded ${recordingPlayback.size} bytes of ${recordingPlayback.type} media. with resolution ${resolution} at ${FrameRate} fps`
                );
            })
            .catch((error) => {
                if (error.name === "NotFoundError") {
                    log("Camera not found. Can't record.");
                } else {
                    log(error);
                }
            });
    },
    false
);

stopButton.addEventListener(
    "click",
    () => {
        stop(preview.srcObject);
    },
    false
);
