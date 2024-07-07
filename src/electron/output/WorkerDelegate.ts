import type { NativeImage, Size } from "electron"
import path from "path"
import { Worker } from "worker_threads"
import electron from "electron"

export class WorkerDelegate {
  static workers: Worker[];
  static promiseMap: Map<number, { resolve: (value: NativeImage) => void, reject: (reason?: any) => void }>;
  static nextRequestId: number;
  static nextWorkerId: number;

  static setupWorkers(initialSize: Size, newSize: Size, poolSize: number = 5) {
    this.workers = [];
    this.promiseMap = new Map();
    this.nextRequestId = 0;
    this.nextWorkerId = 0;

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(path.join(__dirname, 'resizeWorker.js'), {
        workerData: {
          initialSize,
          newSize
        }
      });

      worker.on('message', ({ requestId, resizedImageBuffer }) => {
        const promiseHandlers = this.promiseMap.get(requestId);
        if (promiseHandlers) {
          const resizedImage = electron.nativeImage.createFromBuffer(resizedImageBuffer);
          promiseHandlers.resolve(resizedImage);
          this.promiseMap.delete(requestId);
        }
      });

      worker.on('error', (error) => {
        console.error(`Main process: Worker ${i} error:`, error);
        // Reject all pending promises for this worker
        this.promiseMap.forEach((promiseHandlers, requestId) => {
          if (requestId % this.workers.length === i) {
            promiseHandlers.reject(error);
          }
        });
      });

      worker.on('exit', (code) => {
        console.log(`Main process: Worker ${i} exited with code ${code}`);
        if (code !== 0) {
          // Reject all pending promises for this worker if it exited abnormally
          this.promiseMap.forEach((promiseHandlers, requestId) => {
            if (requestId % this.workers.length === i) {
              promiseHandlers.reject(new Error(`Worker ${i} exited with code ${code}`));
            }
          });
        }
      });

      this.workers.push(worker);
    }
  }

  static async getThumbnail(imageBuffer: Buffer, initialSize: Size, newSize: Size): Promise<NativeImage> {
    if (!this.workers || this.workers.length === 0) this.setupWorkers(initialSize, newSize);

    const requestId = this.nextRequestId++;
    const workerId = this.nextWorkerId;
    this.nextWorkerId = (this.nextWorkerId + 1) % this.workers.length;
    
    return new Promise<NativeImage>((resolve, reject) => {
      this.promiseMap.set(requestId, { resolve, reject });
      this.workers[workerId].postMessage({ requestId, imageBuffer }, [imageBuffer.buffer]);
    });
  }
}