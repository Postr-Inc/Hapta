import CacheController from "../../CacheManager";
import { Tasks } from "../Enums/Tasks";

type TaskCallback = (data: any) => any;
type TaskCallbackWithCollection = (data: {list: any[], collection: string}) => any;

interface Task {
  task: string;
  cb: TaskCallback | TaskCallbackWithCollection;
}
 
class _Worker {
  tasks: Task[];

  constructor() {
    this.tasks = [];
    self.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent) { 
    try {
      const { task, data, threadIndex } = event.data;
      const _task = this.tasks.find((t) => t.task === task);

      if (_task) {
        const result = _task.cb(data); 
        self.postMessage({ threadIndex, result });
      } else {
        console.warn(`Task "${task}" not found.`);
        self.postMessage({ threadIndex, result: null });
      }
    } catch (error) { 
      console.error("Error handling message in worker:", error);
      const threadIndex = event.data.threadIndex;
      self.postMessage({ threadIndex, error });
    }
  }

  public on(task: string, cb: TaskCallback) {
    this.tasks.push({ task, cb });
  }
}

// Example usage:
const worker = new _Worker();
worker.on(Tasks.LOOP, (data: number[]) => { 
  const sum = data.reduce((acc, n) => acc + n, 0);
  return sum;
});

interface Post {
  [key: string]: any;
}

// Helper function to filter emails recursively
const filterEmailsRecursive = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(item => filterEmailsRecursive(item));
  } else if (data && typeof data === 'object') {
    const newData = { ...data };
    Object.keys(newData).forEach((key) => {
      if (key === 'email') {
        delete newData[key];
      } else {
        newData[key] = filterEmailsRecursive(newData[key]);
      }
    });
    return newData;
  }
  return data;
};

// Function to filter emails from a post object
const filterEmails = (post: Post): Post => {
  return filterEmailsRecursive(post);
};

worker.on(Tasks.FILTER_THROUGH_LIST, (data: {list: any[], collection: string}) => {
    let { list, collection } = data;
    console.log(`Filtering through list of ${list.length} items in collection ${collection}`);
    switch(collection){
      case "users":
        return list.map(filterEmails) 
      case "posts":
       return list.map(filterEmails);
    }
});

 