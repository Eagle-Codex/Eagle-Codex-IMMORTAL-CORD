/**
 * IMMORTAL-CORD: Central Execution Engine
 * scheduler.js - Interval controller for pings and loops
 * 
 * This module manages all scheduled tasks and recurring operations
 * for the IMMORTAL-CORD system, acting as the heartbeat initiator.
 */

const cron = require('node-cron');
const logger = require('./logger');

// Store scheduled tasks
const scheduledTasks = {};

// Store next run times
const nextRunTimes = {};

/**
 * Initialize the scheduler
 */
function initScheduler() {
  try {
    logger.info('Initializing scheduler...');
    
    // Get scan interval from environment or use default (6 hours)
    const scanInterval = process.env.SCAN_INTERVAL ? parseInt(process.env.SCAN_INTERVAL) : 360;
    
    // Convert minutes to cron format
    const scanCronExpression = convertMinutesToCron(scanInterval);
    
    logger.info(`Scan interval set to ${scanInterval} minutes (${scanCronExpression})`);
    
    // Schedule tasks will be set up by main.js
    logger.info('Scheduler initialized successfully');
    
    return true;
  } catch (error) {
    logger.error(`Failed to initialize scheduler: ${error.message}`);
    logger.error(error.stack);
    return false;
  }
}

/**
 * Schedule a task
 * @param {string} taskName - Name of the task
 * @param {string} cronExpression - Cron expression for scheduling
 * @param {Function} taskFunction - Function to execute
 */
function scheduleTask(taskName, cronExpression, taskFunction) {
  try {
    logger.info(`Scheduling task: ${taskName} with cron: ${cronExpression}`);
    
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    // Schedule the task
    scheduledTasks[taskName] = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`Executing scheduled task: ${taskName}`);
        
        // Update next run time before execution
        updateNextRunTime(taskName, cronExpression);
        
        // Execute the task
        await taskFunction();
        
        logger.info(`Task ${taskName} executed successfully`);
      } catch (error) {
        logger.error(`Error executing task ${taskName}: ${error.message}`);
        logger.error(error.stack);
      }
    });
    
    // Calculate and store initial next run time
    updateNextRunTime(taskName, cronExpression);
    
    logger.info(`Task ${taskName} scheduled successfully`);
    return true;
  } catch (error) {
    logger.error(`Failed to schedule task ${taskName}: ${error.message}`);
    logger.error(error.stack);
    return false;
  }
}

/**
 * Stop a scheduled task
 * @param {string} taskName - Name of the task to stop
 */
function stopTask(taskName) {
  try {
    if (scheduledTasks[taskName]) {
      scheduledTasks[taskName].stop();
      delete scheduledTasks[taskName];
      delete nextRunTimes[taskName];
      logger.info(`Task ${taskName} stopped successfully`);
      return true;
    } else {
      logger.warn(`Task ${taskName} not found`);
      return false;
    }
  } catch (error) {
    logger.error(`Failed to stop task ${taskName}: ${error.message}`);
    return false;
  }
}

/**
 * Get the next scheduled run time for a task
 * @param {string} taskName - Name of the task
 * @returns {string} Next run time as ISO string, or 'Not scheduled'
 */
function getNextRunTime(taskName) {
  if (nextRunTimes[taskName]) {
    return nextRunTimes[taskName].toISOString();
  } else {
    return 'Not scheduled';
  }
}

/**
 * Get the next scheduled run for any task
 * @returns {string} Next run time as ISO string, or 'No tasks scheduled'
 */
function getNextScheduledRun() {
  const times = Object.values(nextRunTimes);
  
  if (times.length === 0) {
    return 'No tasks scheduled';
  }
  
  // Find the nearest time
  const nextRun = new Date(Math.min(...times.map(time => time.getTime())));
  return nextRun.toISOString();
}

/**
 * List all scheduled tasks
 * @returns {Object} Object with task names as keys and next run times as values
 */
function listScheduledTasks() {
  const tasks = {};
  
  for (const taskName in scheduledTasks) {
    tasks[taskName] = getNextRunTime(taskName);
  }
  
  return tasks;
}

/**
 * Update the next run time for a task
 * @param {string} taskName - Name of the task
 * @param {string} cronExpression - Cron expression for the task
 */
function updateNextRunTime(taskName, cronExpression) {
  try {
    // Calculate next run time
    const interval = cron.schedule(cronExpression, () => {});
    const nextDate = interval.nextDate();
    interval.stop();
    
    nextRunTimes[taskName] = nextDate.toDate();
  } catch (error) {
    logger.error(`Failed to update next run time for ${taskName}: ${error.message}`);
  }
}

/**
 * Convert minutes to cron expression
 * @param {number} minutes - Minutes between executions
 * @returns {string} Cron expression
 */
function convertMinutesToCron(minutes) {
  if (minutes < 1) {
    throw new Error('Minutes must be at least 1');
  }
  
  if (minutes < 60) {
    // Every X minutes
    return `*/${minutes} * * * *`;
  } else {
    // Every X hours
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours < 24) {
      // Every X hours at specific minute
      return `${remainingMinutes} */${hours} * * *`;
    } else {
      // Every X days at specific hour and minute
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      
      if (days === 1) {
        // Daily at specific hour and minute
        return `${remainingMinutes} ${remainingHours} * * *`;
      } else {
        // Every X days at specific hour and minute
        return `${remainingMinutes} ${remainingHours} */${days} * *`;
      }
    }
  }
}

module.exports = {
  initScheduler,
  scheduleTask,
  stopTask,
  getNextRunTime,
  getNextScheduledRun,
  listScheduledTasks
};
