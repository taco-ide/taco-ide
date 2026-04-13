// Main -> Worker
export type WorkerRequest =
  | { type: 'init' }
  | { type: 'execute'; code: string; stdin: string };

// Worker -> Main
export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'loading'; progress?: string }
  | { type: 'result'; stdout: string; stderr: string; hasException: boolean }
  | { type: 'error'; error: string };

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';
