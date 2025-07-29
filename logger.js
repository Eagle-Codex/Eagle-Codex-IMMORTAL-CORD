/**
 * IMMORTAL-CORD: Central Execution Engine
 * logger.js - Logging system for the IMMORTAL-CORD
 * 
 * This module handles all logging operations, including:
 * - Console logging with color coding
 * - File logging with rotation
 * - Log retrieval for status reports
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

// Constants
const LOG_DIR = path.join(__dirname, 'logs');
const CORE_LOG_PATH = path.join(LOG_DIR, 'NINJA_CORE_LOG.md');
const ERROR_LOG_PATH = path.join(LOG_DIR, 'ERROR_LOG.md');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize log files if they don't exist
if (!fs.existsSync(CORE_LOG_PATH)) {
  fs.writeFileSync(CORE_LOG_PATH, '# NINJA CORE LOG\n\n');
}

if (!fs.existsSync(ERROR_LOG_PATH)) {
  fs.writeFileSync(ERROR_LOG_PATH, '# ERROR LOG\n\n');
}

/**
 * Format a log message with timestamp
 * @param {string} level - Log level (info, error, success, etc.)
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
function formatLogMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

/**
 * Format a log message for file logging (Markdown format)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Markdown formatted log entry
 */
function formatMarkdownLog(level, message) {
  const timestamp = new Date().toISOString();
  const date = new Date().toLocaleDateString();
  const time = new Date().toLocaleTimeString();
  
  let emoji = '📝';
  switch (level.toLowerCase()) {
    case 'info':
      emoji = 'ℹ️';
      break;
    case 'error':
      emoji = '❌';
      break;
    case 'warn':
      emoji = '⚠️';
      break;
    case 'success':
      emoji = '✅';
      break;
    case 'debug':
      emoji = '🔍';
      break;
  }
  
  return `\n## ${emoji} ${level.toUpperCase()} - ${date} ${time}\n\n\`\`\`\n${message}\n\`\`\`\n`;
}

/**
 * Write a log entry to file
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {boolean} isError - Whether this is an error log
 */
function writeToFile(level, message, isError = false) {
  try {
    const logPath = isError ? ERROR_LOG_PATH : CORE_LOG_PATH;
    const logEntry = formatMarkdownLog(level, message);
    
    // Check if log file needs rotation
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_LOG_SIZE) {
      rotateLog(logPath);
    }
    
    // Append to log file
    fs.appendFileSync(logPath, logEntry);
  } catch (error) {
    console.error(`Failed to write to log file: ${error.message}`);
  }
}

/**
 * Rotate a log file
 * @param {string} logPath - Path to the log file
 */
function rotateLog(logPath = CORE_LOG_PATH) {
  try {
    if (!fs.existsSync(logPath)) {
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const baseName = path.basename(logPath, path.extname(logPath));
    const ext = path.extname(logPath);
    const archivePath = path.join(LOG_DIR, `${baseName}_${timestamp}${ext}`);
    
    // Rename current log file to archive name
    fs.renameSync(logPath, archivePath);
    
    // Create new log file
    const header = `# ${baseName}\n\nRotated from previous log on ${new Date().toLocaleString()}\n\n`;
    fs.writeFileSync(logPath, header);
    
    // Log the rotation
    console.log(`${colors.cyan}[SYSTEM]${colors.reset} Log rotated: ${logPath} -> ${archivePath}`);
    
    // Clean up old logs if there are too many
    cleanupOldLogs(baseName, ext);
  } catch (error) {
    console.error(`Failed to rotate log: ${error.message}`);
  }
}

/**
 * Clean up old log files
 * @param {string} baseName - Base name of the log file
 * @param {string} ext - Extension of the log file
 * @param {number} maxLogs - Maximum number of log files to keep
 */
function cleanupOldLogs(baseName, ext, maxLogs = 10) {
  try {
    const logFiles = fs.readdirSync(LOG_DIR)
      .filter(file => file.startsWith(baseName) && file !== `${baseName}${ext}` && file.endsWith(ext))
      .map(file => ({
        name: file,
        path: path.join(LOG_DIR, file),
        time: fs.statSync(path.join(LOG_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort by time, newest first
    
    // Delete old logs if there are too many
    if (logFiles.length > maxLogs) {
      logFiles.slice(maxLogs).forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`${colors.cyan}[SYSTEM]${colors.reset} Deleted old log: ${file.name}`);
      });
    }
  } catch (error) {
    console.error(`Failed to clean up old logs: ${error.message}`);
  }
}

/**
 * Log an info message
 * @param {string} message - Message to log
 */
function info(message) {
  const formattedMessage = formatLogMessage('INFO', message);
  console.log(`${colors.cyan}${formattedMessage}${colors.reset}`);
  writeToFile('INFO', message);
}

/**
 * Log an error message
 * @param {string} message - Message to log
 */
function error(message) {
  const formattedMessage = formatLogMessage('ERROR', message);
  console.error(`${colors.red}${formattedMessage}${colors.reset}`);
  writeToFile('ERROR', message, true);
  writeToFile('ERROR', message); // Also write to main log
}

/**
 * Log a warning message
 * @param {string} message - Message to log
 */
function warn(message) {
  const formattedMessage = formatLogMessage('WARN', message);
  console.warn(`${colors.yellow}${formattedMessage}${colors.reset}`);
  writeToFile('WARN', message);
}

/**
 * Log a success message
 * @param {string} message - Message to log
 */
function success(message) {
  const formattedMessage = formatLogMessage('SUCCESS', message);
  console.log(`${colors.green}${formattedMessage}${colors.reset}`);
  writeToFile('SUCCESS', message);
}

/**
 * Log a debug message
 * @param {string} message - Message to log
 */
function debug(message) {
  // Only log debug messages if LOG_LEVEL is set to debug
  if (process.env.LOG_LEVEL && process.env.LOG_LEVEL.toLowerCase() === 'debug') {
    const formattedMessage = formatLogMessage('DEBUG', message);
    console.log(`${colors.dim}${formattedMessage}${colors.reset}`);
    writeToFile('DEBUG', message);
  }
}

/**
 * Get the number of log entries
 * @returns {Promise<number>} Number of log entries
 */
async function getLogCount() {
  try {
    if (!fs.existsSync(CORE_LOG_PATH)) {
      return 0;
    }
    
    const content = fs.readFileSync(CORE_LOG_PATH, 'utf8');
    const entries = content.match(/## .+ - /g);
    
    return entries ? entries.length : 0;
  } catch (error) {
    console.error(`Failed to get log count: ${error.message}`);
    return 0;
  }
}

/**
 * Get recent log entries
 * @param {number} count - Number of entries to retrieve
 * @returns {Promise<string>} Recent log entries in Markdown format
 */
async function getRecentLogs(count = 5) {
  try {
    if (!fs.existsSync(CORE_LOG_PATH)) {
      return 'No logs available';
    }
    
    const content = fs.readFileSync(CORE_LOG_PATH, 'utf8');
    const entries = content.split(/\n## /);
    
    // Skip the header (first entry)
    const logs = entries.slice(1).map(entry => `## ${entry.trim()}`);
    
    // Get the most recent logs
    const recentLogs = logs.slice(-count).reverse();
    
    if (recentLogs.length === 0) {
      return 'No recent logs';
    }
    
    return recentLogs.join('\n\n');
  } catch (error) {
    console.error(`Failed to get recent logs: ${error.message}`);
    return 'Error retrieving logs';
  }
}

module.exports = {
  info,
  error,
  warn,
  success,
  debug,
  rotateLog,
  getLogCount,
  getRecentLogs
};
