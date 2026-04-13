const PYODIDE_CDN_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';
const MAX_OUTPUT_LENGTH = 100000;

let pyodide = null;

async function loadPyodideInstance() {
  if (pyodide) return pyodide;

  importScripts(`${PYODIDE_CDN_URL}pyodide.js`);

  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN_URL });
  return pyodide;
}

function truncateOutput(text) {
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  return text.slice(0, MAX_OUTPUT_LENGTH) + '\n[output truncated]';
}

self.onmessage = async (event) => {
  const message = event.data;

  if (message.type === 'init') {
    try {
      self.postMessage({ type: 'loading', progress: 'Loading Python runtime...' });
      await loadPyodideInstance();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Failed to load Python runtime',
      });
    }
    return;
  }

  if (message.type === 'execute') {
    try {
      const instance = await loadPyodideInstance();

      instance.globals.set('_js_stdin_content', message.stdin);

      await instance.runPythonAsync(`
import sys
from io import StringIO
sys.stdin = StringIO(_js_stdin_content)
_stdout_capture = StringIO()
_stderr_capture = StringIO()
sys.stdout = _stdout_capture
sys.stderr = _stderr_capture
`);

      await instance.runPythonAsync(message.code);

      const stdout = String(await instance.runPythonAsync('_stdout_capture.getvalue()'));
      const stderr = String(await instance.runPythonAsync('_stderr_capture.getvalue()'));

      await instance.runPythonAsync(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
sys.stdin = sys.__stdin__
`);

      self.postMessage({
        type: 'result',
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
      });
    } catch (err) {
      const stderr = err instanceof Error ? err.message : String(err);

      if (pyodide) {
        try {
          await pyodide.runPythonAsync(`
try:
  import sys
  sys.stdout = sys.__stdout__
  sys.stderr = sys.__stderr__
  sys.stdin = sys.__stdin__
except Exception:
  pass
`);
        } catch (_) {
          // ignore cleanup errors
        }
      }

      self.postMessage({ type: 'result', stdout: '', stderr });
    }
  }
};
