const { workerData, parentPort } = require('worker_threads');
const sharp = require('sharp');

console.log("Worker: Started");

function resizeImageWorker(imageBuffer, initialSize, newSize) {
  console.log("Worker: Resizing image");
  
  let resizeOptions;
  if (initialSize.width / initialSize.height >= newSize.width / newSize.height) {
    resizeOptions = { width: newSize.width };
  } else {
    resizeOptions = { height: newSize.height };
  }

  return sharp(imageBuffer)
    .resize(resizeOptions)
    .png()
    .toBuffer();
}

console.log("Worker: Setting up message listener");

if (parentPort) {
  parentPort.once('message', async (imageBuffer) => {
    console.log("Worker: Received message");
    try {
      const resizedImageBuffer = await resizeImageWorker(imageBuffer, workerData.initialSize, workerData.newSize);
      console.log("Worker: Resizing complete, sending result");
      parentPort.postMessage(resizedImageBuffer, [resizedImageBuffer.buffer]);
    } catch (error) {
      console.error("Worker: Error occurred", error);
      parentPort.postMessage({ error: error.message });
    }
  });
} else {
  console.error("Worker: No parentPort available");
}

console.log("Worker: Setup complete");

// Add error handling
process.on('uncaughtException', (error) => {
  console.error('Worker: Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Worker: Unhandled Rejection at:', promise, 'reason:', reason);
});