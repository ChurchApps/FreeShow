const { workerData, parentPort } = require('worker_threads');
const sharp = require('sharp');

console.log("Worker: Started");

function resizeImageWorker(imageBuffer, initialSize, newSize) {
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

async function handleMessage(requestId, imageBuffer) {
  console.log("Worker: Received message for requestId:", requestId);
  let start = new Date().getTime();
  try {
    const resizedImageBuffer = await resizeImageWorker(imageBuffer, workerData.initialSize, workerData.newSize);
    const end = new Date().getTime();
    console.log(`Worker: Resizing took ${end - start}ms for requestId: ${requestId}`);
    parentPort.postMessage({ requestId, resizedImageBuffer }, [resizedImageBuffer.buffer]);
  } catch (error) {
    console.error(`Worker: Error occurred for requestId: ${requestId}`, error);
    parentPort.postMessage({ requestId, error: error.message });
  }
}

console.log("Worker: Setting up message listener");

if (parentPort) {
  parentPort.on('message', async ({ requestId, imageBuffer }) => {
    handleMessage(requestId, imageBuffer);
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