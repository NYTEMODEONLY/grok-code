const config = require('../core/config');
const display = require('../ui/display');
const moment = require('moment');
const Table = require('cli-table3');
const chalk = require('chalk');

class StatsCommand {
  constructor() {
    this.name = 'stats';
    this.description = 'Display detailed usage statistics and analytics';
  }

  async execute(args = []) {
    const stats = config.getStatistics();
    
    if (args.includes('--detailed') || args.includes('-d')) {
      await this.showDetailedStats(stats);
    } else if (args.includes('--export') || args.includes('-e')) {
      await this.exportStats(stats);
    } else if (args.includes('--reset') || args.includes('-r')) {
      await this.resetStats();
    } else {
      display.showStatistics();
    }
  }

  async showDetailedStats(stats) {
    display.showStatistics();
    
    // Additional detailed analytics
    console.log(chalk.cyan.bold('\n📊 DETAILED ANALYTICS\n'));
    
    // Productivity metrics
    const totalTime = stats.sessionHistory.reduce((sum, session) => sum + (session.duration || 0), 0);
    const avgSessionTime = stats.totalSessions > 0 ? totalTime / stats.totalSessions : 0;
    const avgTokensPerRequest = stats.totalRequests > 0 ? stats.totalTokensUsed / stats.totalRequests : 0;
    const avgFilesPerSession = stats.totalSessions > 0 ? (stats.totalFilesCreated + stats.totalFilesEdited) / stats.totalSessions : 0;
    
    const metricsTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [30, 25]
    });

    metricsTable.push(
      ['Total Time Spent', `${Math.round(totalTime / 60000)} minutes`],
      ['Average Session Time', `${Math.round(avgSessionTime / 60000)} minutes`],
      ['Avg Tokens per Request', Math.round(avgTokensPerRequest)],
      ['Avg Files per Session', avgFilesPerSession.toFixed(1)],
      ['Success Rate', `${((stats.totalRequests - stats.errors) / stats.totalRequests * 100).toFixed(1)}%`],
      ['Most Active Day', this.getMostActiveDay(stats.dailyUsage)],
      ['Peak Usage Hour', this.getPeakUsageHour(stats.sessionHistory)]
    );

    console.log(metricsTable.toString());

    // Weekly trends
    this.showWeeklyTrends(stats.weeklyUsage);
    
    // Monthly trends
    this.showMonthlyTrends(stats.monthlyUsage);
    
    // Performance analysis
    this.showPerformanceAnalysis(stats);
  }

  showWeeklyTrends(weeklyUsage) {
    if (!weeklyUsage || Object.keys(weeklyUsage).length === 0) return;

    console.log(chalk.cyan.bold('\n📈 WEEKLY TRENDS\n'));
    
    const weeks = Object.keys(weeklyUsage).sort().slice(-8);
    const trendTable = new Table({
      head: [chalk.cyan('Week'), chalk.cyan('Requests'), chalk.cyan('Tokens'), chalk.cyan('Files'), chalk.cyan('Commands')],
      colWidths: [15, 12, 12, 12, 12]
    });

    weeks.forEach(week => {
      const data = weeklyUsage[week];
      const weekLabel = this.formatWeekLabel(week);
      trendTable.push([
        weekLabel,
        data.requests,
        data.tokens.toLocaleString(),
        data.filesCreated + data.filesEdited,
        data.commandsExecuted
      ]);
    });

    console.log(trendTable.toString());
  }

  showMonthlyTrends(monthlyUsage) {
    if (!monthlyUsage || Object.keys(monthlyUsage).length === 0) return;

    console.log(chalk.cyan.bold('\n📅 MONTHLY TRENDS\n'));
    
    const months = Object.keys(monthlyUsage).sort().slice(-6);
    const trendTable = new Table({
      head: [chalk.cyan('Month'), chalk.cyan('Requests'), chalk.cyan('Tokens'), chalk.cyan('Files'), chalk.cyan('Commands')],
      colWidths: [15, 12, 12, 12, 12]
    });

    months.forEach(month => {
      const data = monthlyUsage[month];
      const monthLabel = moment(month + '-01').format('MMM YYYY');
      trendTable.push([
        monthLabel,
        data.requests,
        data.tokens.toLocaleString(),
        data.filesCreated + data.filesEdited,
        data.commandsExecuted
      ]);
    });

    console.log(trendTable.toString());
  }

  showPerformanceAnalysis(stats) {
    console.log(chalk.cyan.bold('\n⚡ PERFORMANCE ANALYSIS\n'));
    
    const performanceTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value'), chalk.cyan('Status')],
      colWidths: [25, 20, 15]
    });

    // Response time analysis
    const avgResponseTime = stats.averageResponseTime;
    let responseTimeStatus = 'Good';
    let responseTimeColor = chalk.green;
    
    if (avgResponseTime > 5000) {
      responseTimeStatus = 'Slow';
      responseTimeColor = chalk.red;
    } else if (avgResponseTime > 2000) {
      responseTimeStatus = 'Fair';
      responseTimeColor = chalk.yellow;
    }

    performanceTable.push([
      'Average Response Time',
      `${avgResponseTime.toFixed(0)}ms`,
      responseTimeColor(responseTimeStatus)
    ]);

    // Token efficiency
    const tokensPerRequest = stats.totalRequests > 0 ? stats.totalTokensUsed / stats.totalRequests : 0;
    let tokenEfficiencyStatus = 'Good';
    let tokenEfficiencyColor = chalk.green;
    
    if (tokensPerRequest > 2000) {
      tokenEfficiencyStatus = 'High Usage';
      tokenEfficiencyColor = chalk.yellow;
    } else if (tokensPerRequest > 4000) {
      tokenEfficiencyStatus = 'Very High';
      tokenEfficiencyColor = chalk.red;
    }

    performanceTable.push([
      'Tokens per Request',
      Math.round(tokensPerRequest),
      tokenEfficiencyColor(tokenEfficiencyStatus)
    ]);

    // Session frequency
    const daysSinceFirstUse = stats.lastUsed ? moment().diff(moment(stats.lastUsed), 'days') : 0;
    const sessionsPerDay = daysSinceFirstUse > 0 ? stats.totalSessions / daysSinceFirstUse : 0;
    
    let sessionFrequencyStatus = 'Good';
    let sessionFrequencyColor = chalk.green;
    
    if (sessionsPerDay > 5) {
      sessionFrequencyStatus = 'Very Active';
      sessionFrequencyColor = chalk.cyan;
    } else if (sessionsPerDay < 0.5) {
      sessionFrequencyStatus = 'Low Usage';
      sessionFrequencyColor = chalk.yellow;
    }

    performanceTable.push([
      'Sessions per Day',
      sessionsPerDay.toFixed(1),
      sessionFrequencyColor(sessionFrequencyStatus)
    ]);

    console.log(performanceTable.toString());
  }

  getMostActiveDay(dailyUsage) {
    if (!dailyUsage || Object.keys(dailyUsage).length === 0) return 'N/A';
    
    const days = Object.entries(dailyUsage);
    const mostActive = days.reduce((max, [date, data]) => 
      data.requests > max.requests ? { date, ...data } : max, 
      { date: '', requests: 0 }
    );
    
    return mostActive.date ? moment(mostActive.date).format('MMM DD, YYYY') : 'N/A';
  }

  getPeakUsageHour(sessionHistory) {
    if (!sessionHistory || sessionHistory.length === 0) return 'N/A';
    
    const hourCounts = {};
    sessionHistory.forEach(session => {
      const hour = moment(session.start).format('HH:00');
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) => 
      count > max.count ? { hour, count } : max, 
      { hour: '', count: 0 }
    );
    
    return peakHour.hour || 'N/A';
  }

  formatWeekLabel(week) {
    const [year, weekNum] = week.split('-W');
    const weekStart = moment().year(year).week(parseInt(weekNum)).startOf('week');
    return weekStart.format('MMM DD');
  }

  async exportStats(stats) {
    const exportData = {
      exportDate: new Date().toISOString(),
      statistics: stats,
      summary: {
        totalSessions: stats.totalSessions,
        totalRequests: stats.totalRequests,
        totalTokensUsed: stats.totalTokensUsed,
        totalFilesCreated: stats.totalFilesCreated,
        totalFilesEdited: stats.totalFilesEdited,
        totalCommandsExecuted: stats.totalCommandsExecuted,
        averageResponseTime: stats.averageResponseTime
      }
    };

    const filename = `grok-stats-${moment().format('YYYY-MM-DD-HHmmss')}.json`;
    const fs = require('fs-extra');
    
    try {
      await fs.writeJson(filename, exportData, { spaces: 2 });
      display.success(`Statistics exported to ${filename}`);
    } catch (error) {
      display.error(`Failed to export statistics: ${error.message}`);
    }
  }

  async resetStats() {
    const inquirer = require('inquirer');
    
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to reset all statistics? This action cannot be undone.',
        default: false
      }
    ]);

    if (answer.confirm) {
      config.reset();
      display.success('All statistics have been reset');
    } else {
      display.info('Statistics reset cancelled');
    }
  }

  getHelp() {
    return `
Usage: /stats [options]

Options:
  -d, --detailed    Show detailed analytics and trends
  -e, --export      Export statistics to JSON file
  -r, --reset       Reset all statistics (requires confirmation)

Examples:
  /stats             Show basic statistics
  /stats -d          Show detailed analytics
  /stats --export    Export statistics to file
  /stats --reset     Reset all statistics
    `;
  }
}

module.exports = new StatsCommand();