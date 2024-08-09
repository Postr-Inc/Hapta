 
interface Task {
  task: string;
  data: any;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export default class Concurrency {
  threadCount: number;
  threads: Worker[] = [];
  threadInUse: boolean[] = [];
  taskQueue: Task[] = [];
  cpuCount = require("os").cpus().length;

  constructor(threadCount: number = 2) {
    this.threadCount = threadCount;

    for (let i = 0; i < this.threadCount; i++) {
      this.createWorker(i);
    }
  }

  public polorize(data: any, time: number) {
    
  }
  private createWorker(index: number) {
    //@ts-ignore
    const worker = new Worker(new URL("./worker/index.ts", import.meta.url).href);

    worker.onmessage = (e) => {
      const { threadIndex, result } = e.data; 
      this.threadInUse[threadIndex] = false; 
      const currentTask = this.taskQueue.shift(); 
      if (currentTask) {
        currentTask.resolve(result);
      }   
      this.processNextTask();
    };

    worker.onerror = (e) => {
      const { threadIndex, error } = e as any;
      this.threadInUse[threadIndex] = false;
      const currentTask = this.taskQueue.shift();
      if (currentTask) {
        currentTask.reject(error);
      }
      console.error(`Error in worker ${index}:`, e);
      this.processNextTask();
    };

    this.threads.push(worker);
    this.threadInUse.push(false);
  }

  private processNextTask() {
    if (this.taskQueue.length > 0) {
      const { task, data, resolve, reject } = this.taskQueue.shift() as Task; 
      this.runTask(task, data, resolve, reject);
    }

    // Check if we need to add more threads
    if (this.allThreadsBusy() && this.threads.length < this.cpuCount) {
      console.log("All threads busy, creating new worker...");
      this.createWorker(this.threads.length);
    }
  }

  private allThreadsBusy() {
    return this.threadInUse.every((inUse) => inUse);
  }

  public run(task: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this.threads.length; i++) {
        if (!this.threadInUse[i]) {
          this.runTask(task, data, resolve, reject, i);
          return;
        }
      }

      // If no threads are available, push the task to the queue
      this.taskQueue.push({ task, data, resolve, reject });
    });
  }

  private runTask(task: string, data: any, resolve: (value: any) => void, reject: (reason?: any) => void, threadIndex?: number) {
    if (threadIndex === undefined) {
      for (let i = 0; i < this.threads.length; i++) {
        if (!this.threadInUse[i]) {
          threadIndex = i;
          break;
        }
      }
    }

    if (threadIndex !== undefined) {
      this.threadInUse[threadIndex] = true;
      this.threads[threadIndex].postMessage({ task, data, threadIndex });
      this.taskQueue.push({ task, data, resolve, reject });
    }
  }
}
