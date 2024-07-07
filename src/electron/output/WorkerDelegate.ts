import type { NativeImage, Size } from "electron"
import path from "path"
import { Worker } from "worker_threads"
import electron from "electron"

export class WorkerDelegate {
  static worker: Worker;
  static promiseMap: Map<number, { resolve: (value: NativeImage) => void, reject: (reason?: any) => void }>;
  static nextRequestId: number;

  static setupWorker(initialSize: Size, newSize: Size) {
    this.worker = new Worker(path.join(__dirname, 'resizeWorker.js'), {
      workerData: {
        initialSize,
        newSize
      }
    });

    this.promiseMap = new Map();
    this.nextRequestId = 0;

    this.worker.on('message', ({ requestId, resizedImageBuffer }) => {
      const promiseHandlers = this.promiseMap.get(requestId);
      if (promiseHandlers) {
        const resizedImage = electron.nativeImage.createFromBuffer(resizedImageBuffer);
        promiseHandlers.resolve(resizedImage);
        this.promiseMap.delete(requestId);
      }
    });

    this.worker.on('error', (error) => {
      console.error("Main process: Worker error:", error);
      // Reject all pending promises
      this.promiseMap.forEach(promiseHandlers => promiseHandlers.reject(error));
      this.promiseMap.clear();
    });

    this.worker.on('exit', (code) => {
      console.log(`Main process: Worker exited with code ${code}`);
      if (code !== 0) {
        // Reject all pending promises if worker exited abnormally
        this.promiseMap.forEach(promiseHandlers => 
          promiseHandlers.reject(new Error(`Worker exited with code ${code}`))
        );
        this.promiseMap.clear();
      }
    });
  }

  static async getThumbnail(imageBuffer: Buffer, initialSize: Size, newSize: Size): Promise<NativeImage> {
    if (!this.worker) this.setupWorker(initialSize, newSize);

    const requestId = this.nextRequestId++;
    
    return new Promise<NativeImage>((resolve, reject) => {
      this.promiseMap.set(requestId, { resolve, reject });
      this.worker.postMessage({ requestId, imageBuffer }, [imageBuffer.buffer]);
    });
  }
}