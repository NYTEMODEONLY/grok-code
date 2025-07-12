#!/usr/bin/env node

const { program } = require('commander');
const GrokCodeApp = require('../src/index');

program
  .name('grok')
  .description('Grok Code CLI')
  .version('1.0.0');

program.action(async () => {
  const app = new GrokCodeApp();
  
  try {
    const initialized = await app.initialize();
    if (initialized) {
      await app.run();
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('Application failed to start:', error.message);
    process.exit(1);
  }
});

program.parse();

