'use strict';

const { EventEmitter } = require('events');

class Logger extends EventEmitter {
  constructor() {
    super();
    this._win = null;
  }

  setWindow(win) {
    this._win = win;
  }

  _send(level, message) {
    const ts = new Date().toISOString().slice(11, 19);
    const entry = { timestamp: ts, level, message };
    const prefix = `[${ts}] [${level}]`;
    if (level === 'ERROR') console.error(prefix, message);
    else if (level === 'WARNING') console.warn(prefix, message);
    else console.log(prefix, message);
    if (this._win && !this._win.isDestroyed()) {
      this._win.webContents.send('bridge-reply', { type: 'log', data: { message: `[${level}] ${message}` } });
    }
    this.emit('log', entry);
  }

  info(msg) { this._send('INFO', msg); }
  warn(msg) { this._send('WARNING', msg); }
  error(msg) { this._send('ERROR', msg); }
  debug(msg) { this._send('DEBUG', msg); }
  success(msg) { this._send('SUCCESS', msg); }

  progress(operation, current, total, detail) {
    if (this._win && !this._win.isDestroyed()) {
      this._win.webContents.send('bridge-reply', {
        type: 'log',
        data: { message: `[${operation}] ${current}/${total} ${detail}` }
      });
    }
  }
}

const logger = new Logger();
module.exports = logger;
