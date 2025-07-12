const Conf = require('conf');
const CryptoJS = require('crypto-js');
const path = require('path');
const fs = require('fs-extra');

class Config {
  constructor() {
    this.config = new Conf({
      projectName: 'grok-code',
      schema: {
        apiKey: {
          type: 'string',
          default: ''
        },
        model: {
          type: 'string',
          default: 'grok-3-beta'
        },
        theme: {
          type: 'string',
          default: 'default'
        },
        maxTokens: {
          type: 'number',
          default: 4096
        },
        temperature: {
          type: 'number',
          default: 0.7
        },
        autoSave: {
          type: 'boolean',
          default: true
        },
        enableAnalytics: {
          type: 'boolean',
          default: true
        },
        statistics: {
          type: 'object',
          default: {
            totalSessions: 0,
            totalRequests: 0,
            totalTokensUsed: 0,
            totalFilesCreated: 0,
            totalFilesEdited: 0,
            totalCommandsExecuted: 0,
            averageResponseTime: 0,
            lastUsed: null,
            sessionHistory: [],
            dailyUsage: {},
            weeklyUsage: {},
            monthlyUsage: {}
          }
        },
        preferences: {
          type: 'object',
          default: {
            defaultLanguage: 'javascript',
            autoCommit: false,
            autoPush: false,
            showProgressBars: true,
            enableSound: false,
            maxContextFiles: 10
          }
        }
      }
    });
  }

  // API Key Management with Encryption
  getApiKey() {
    const encrypted = this.config.get('apiKey');
    if (!encrypted) return null;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, this.getMachineId()).toString(CryptoJS.enc.Utf8);
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt API key:', error.message);
      return null;
    }
  }

  setApiKey(apiKey) {
    const encrypted = CryptoJS.AES.encrypt(apiKey, this.getMachineId()).toString();
    this.config.set('apiKey', encrypted);
  }

  // Machine-specific encryption key
  getMachineId() {
    const os = require('os');
    return CryptoJS.SHA256(os.hostname() + os.platform() + os.arch()).toString();
  }

  // Statistics Management
  updateStatistics(data) {
    const stats = this.config.get('statistics');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const week = this.getWeekNumber(now);
    const month = now.toISOString().slice(0, 7);

    // Update session data
    if (data.sessionStart) {
      stats.totalSessions++;
      stats.lastUsed = now.toISOString();
      
      if (!stats.sessionHistory) stats.sessionHistory = [];
      stats.sessionHistory.push({
        start: now.toISOString(),
        duration: data.duration || 0,
        requests: data.requests || 0,
        tokens: data.tokens || 0
      });

      // Keep only last 100 sessions
      if (stats.sessionHistory.length > 100) {
        stats.sessionHistory = stats.sessionHistory.slice(-100);
      }
    }

    // Update request data
    if (data.requests) {
      stats.totalRequests += data.requests;
    }

    if (data.tokens) {
      stats.totalTokensUsed += data.tokens;
    }

    if (data.filesCreated) {
      stats.totalFilesCreated += data.filesCreated;
    }

    if (data.filesEdited) {
      stats.totalFilesEdited += data.filesEdited;
    }

    if (data.commandsExecuted) {
      stats.totalCommandsExecuted += data.commandsExecuted;
    }

    if (data.responseTime) {
      const currentAvg = stats.averageResponseTime;
      const totalRequests = stats.totalRequests;
      stats.averageResponseTime = ((currentAvg * (totalRequests - 1)) + data.responseTime) / totalRequests;
    }

    // Update daily usage
    if (!stats.dailyUsage[today]) {
      stats.dailyUsage[today] = {
        requests: 0,
        tokens: 0,
        filesCreated: 0,
        filesEdited: 0,
        commandsExecuted: 0
      };
    }

    if (data.requests) stats.dailyUsage[today].requests += data.requests;
    if (data.tokens) stats.dailyUsage[today].tokens += data.tokens;
    if (data.filesCreated) stats.dailyUsage[today].filesCreated += data.filesCreated;
    if (data.filesEdited) stats.dailyUsage[today].filesEdited += data.filesEdited;
    if (data.commandsExecuted) stats.dailyUsage[today].commandsExecuted += data.commandsExecuted;

    // Update weekly usage
    if (!stats.weeklyUsage[week]) {
      stats.weeklyUsage[week] = {
        requests: 0,
        tokens: 0,
        filesCreated: 0,
        filesEdited: 0,
        commandsExecuted: 0
      };
    }

    if (data.requests) stats.weeklyUsage[week].requests += data.requests;
    if (data.tokens) stats.weeklyUsage[week].tokens += data.tokens;
    if (data.filesCreated) stats.weeklyUsage[week].filesCreated += data.filesCreated;
    if (data.filesEdited) stats.weeklyUsage[week].filesEdited += data.filesEdited;
    if (data.commandsExecuted) stats.weeklyUsage[week].commandsExecuted += data.commandsExecuted;

    // Update monthly usage
    if (!stats.monthlyUsage[month]) {
      stats.monthlyUsage[month] = {
        requests: 0,
        tokens: 0,
        filesCreated: 0,
        filesEdited: 0,
        commandsExecuted: 0
      };
    }

    if (data.requests) stats.monthlyUsage[month].requests += data.requests;
    if (data.tokens) stats.monthlyUsage[month].tokens += data.tokens;
    if (data.filesCreated) stats.monthlyUsage[month].filesCreated += data.filesCreated;
    if (data.filesEdited) stats.monthlyUsage[month].filesEdited += data.filesEdited;
    if (data.commandsExecuted) stats.monthlyUsage[month].commandsExecuted += data.commandsExecuted;

    // Clean up old data (keep last 12 months)
    this.cleanupOldData(stats);

    this.config.set('statistics', stats);
  }

  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return `${d.getUTCFullYear()}-W${Math.ceil((((d - yearStart) / 86400000) + 1) / 7)}`;
  }

  cleanupOldData(stats) {
    const now = new Date();
    const cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Clean daily usage (keep last 365 days)
    Object.keys(stats.dailyUsage).forEach(date => {
      if (new Date(date) < cutoffDate) {
        delete stats.dailyUsage[date];
      }
    });

    // Clean weekly usage (keep last 52 weeks)
    Object.keys(stats.weeklyUsage).forEach(week => {
      const weekDate = new Date(week.split('-')[0], 0, 1);
      if (weekDate < cutoffDate) {
        delete stats.weeklyUsage[week];
      }
    });

    // Clean monthly usage (keep last 12 months)
    Object.keys(stats.monthlyUsage).forEach(month => {
      const monthDate = new Date(month + '-01');
      if (monthDate < cutoffDate) {
        delete stats.monthlyUsage[month];
      }
    });
  }

  getStatistics() {
    return this.config.get('statistics');
  }

  // Preferences Management
  getPreference(key) {
    const preferences = this.config.get('preferences');
    return preferences[key];
  }

  setPreference(key, value) {
    const preferences = this.config.get('preferences');
    preferences[key] = value;
    this.config.set('preferences', preferences);
  }

  // Model Configuration
  getModel() {
    return this.config.get('model');
  }

  setModel(model) {
    this.config.set('model', model);
  }

  getMaxTokens() {
    return this.config.get('maxTokens');
  }

  setMaxTokens(tokens) {
    this.config.set('maxTokens', tokens);
  }

  getTemperature() {
    return this.config.get('temperature');
  }

  setTemperature(temp) {
    this.config.set('temperature', temp);
  }

  // Theme Management
  getTheme() {
    return this.config.get('theme');
  }

  setTheme(theme) {
    this.config.set('theme', theme);
  }

  // Analytics Settings
  isAnalyticsEnabled() {
    return this.config.get('enableAnalytics');
  }

  setAnalyticsEnabled(enabled) {
    this.config.set('enableAnalytics', enabled);
  }

  // Reset Configuration
  reset() {
    this.config.clear();
  }

  // Export/Import Configuration
  exportConfig() {
    const config = {
      model: this.getModel(),
      maxTokens: this.getMaxTokens(),
      temperature: this.getTemperature(),
      theme: this.getTheme(),
      preferences: this.config.get('preferences'),
      statistics: this.config.get('statistics')
    };
    return JSON.stringify(config, null, 2);
  }

  importConfig(configString) {
    try {
      const config = JSON.parse(configString);
      if (config.model) this.setModel(config.model);
      if (config.maxTokens) this.setMaxTokens(config.maxTokens);
      if (config.temperature) this.setTemperature(config.temperature);
      if (config.theme) this.setTheme(config.theme);
      if (config.preferences) this.config.set('preferences', config.preferences);
      if (config.statistics) this.config.set('statistics', config.statistics);
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error.message);
      return false;
    }
  }
}

module.exports = new Config();