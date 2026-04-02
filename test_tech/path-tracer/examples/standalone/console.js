/**
 * Minimalist web terminal/console utility.
 * Captures console.log, warn, and error to display in a dedicated UI pane.
 */
export function initConsole(paneId) {
    const pane = document.getElementById(paneId);
    if (!pane) return;

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const appendLog = (args, type) => {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const prefix = document.createElement('span');
        prefix.className = 'log-prefix';
        prefix.textContent = `[${timestamp}] [${type.toUpperCase()}] > `;
        
        const content = document.createElement('span');
        content.textContent = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
        
        line.appendChild(prefix);
        line.appendChild(content);
        pane.appendChild(line);
        
        // Auto-scroll to bottom
        pane.scrollTop = pane.scrollHeight;
    };

    console.log = (...args) => {
        originalLog.apply(console, args);
        appendLog(args, 'log');
    };

    console.warn = (...args) => {
        originalWarn.apply(console, args);
        appendLog(args, 'warn');
    };

    console.error = (...args) => {
        originalError.apply(console, args);
        appendLog(args, 'error');
    };

    console.log("Terminal initialized. Ready for output.");
}
