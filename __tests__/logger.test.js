const fs = require('fs-extra');
const path = require('path');
const ErrorLogger = require('../bin/grok.js').ErrorLogger; // Adjust path if modularized

describe('ErrorLogger', () => {
  let logger;
  const logFile = path.join(__dirname, '../.grok/test.log');

  beforeEach(() => {
    logger = new ErrorLogger(logFile);
    fs.ensureDirSync(path.dirname(logFile));
  });

  afterEach(() => {
    fs.removeSync(logFile);
  });

  test('should log info message', () => {
    logger.info('Test info');
    const logs = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    expect(logs.length).toBeGreaterThan(0);
    const lastLog = JSON.parse(logs[logs.length - 1]);
    expect(lastLog.level).toBe('info');
    expect(lastLog.message).toBe('Test info');
  });

  test('should log error with stack', () => {
    const err = new Error('Test error');
    logger.error('Test error log', err);
    const logs = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
    const lastLog = JSON.parse(logs[logs.length - 1]);
    expect(lastLog.level).toBe('error');
    expect(lastLog.error.message).toBe('Test error');
  });
});
