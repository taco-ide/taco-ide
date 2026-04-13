import type { PyodideStatus, WorkerRequest, WorkerResponse } from './types';

const EXECUTION_TIMEOUT = 10_000;

export class PyodideService {
  private worker: Worker | null = null;
  private status: PyodideStatus = 'idle';
  private statusListeners = new Set<(status: PyodideStatus) => void>();
  private initPromise: Promise<void> | null = null;

  getStatus(): PyodideStatus {
    return this.status;
  }

  onStatusChange(listener: (status: PyodideStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: PyodideStatus) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  private createWorker(): Worker {
    return new Worker('/pyodide.worker.js');
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    return this.worker;
  }

  async preload(): Promise<void> {
    if (this.status === 'ready' || this.status === 'loading') return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      const worker = this.ensureWorker();
      this.setStatus('loading');

      const cleanup = () => {
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
      };

      const messageHandler = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'ready') {
          cleanup();
          this.setStatus('ready');
          resolve();
        } else if (event.data.type === 'error') {
          cleanup();
          this.setStatus('error');
          reject(new Error(event.data.error));
        }
      };

      const errorHandler = () => {
        cleanup();
        this.setStatus('error');
        this.initPromise = null;
        reject(new Error('Failed to load Python worker'));
      };

      worker.addEventListener('message', messageHandler);
      worker.addEventListener('error', errorHandler);
      worker.postMessage({ type: 'init' } satisfies WorkerRequest);
    });

    return this.initPromise;
  }

  async execute(
    code: string,
    stdin: string,
    timeout = EXECUTION_TIMEOUT,
  ): Promise<{ stdout: string; stderr: string }> {
    await this.preload();

    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker();

      const timer = setTimeout(() => {
        worker.removeEventListener('message', handler);
        this.terminateWorker();
        reject(
          new Error(
            'Tempo limite de execucao excedido. Seu codigo pode conter um loop infinito.',
          ),
        );
      }, timeout);

      const handler = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        if (data.type === 'result') {
          clearTimeout(timer);
          worker.removeEventListener('message', handler);
          resolve({ stdout: data.stdout, stderr: data.stderr });
        } else if (data.type === 'error') {
          clearTimeout(timer);
          worker.removeEventListener('message', handler);
          reject(new Error(data.error));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'execute', code, stdin } satisfies WorkerRequest);
    });
  }

  private terminateWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initPromise = null;
      this.setStatus('idle');
    }
  }

  terminate() {
    this.terminateWorker();
  }
}

export const pyodideService = new PyodideService();
