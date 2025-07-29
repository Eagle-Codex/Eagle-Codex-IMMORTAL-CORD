/**
 * IMMORTAL-CORD: Central Execution Engine
 * clickup-manager.js - ClickUp integration for task mirroring
 * 
 * This module handles all interactions with ClickUp, including:
 * - Creating tasks from Google Drive files
 * - Updating tasks based on file changes
 * - Organizing tasks by tags and folders
 * - Tracking task statistics
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const vault = require('./vault');

// Constants
const VAULT_DIR = path.join(__dirname, 'vault');
const TASK_INDEX_PATH = path.join(VAULT_DIR, 'ClickUp_Task_Index.json');

// Cache for task counts
let taskCountCache = null;
let lastSyncTime = null;

/**
 * Mirror files to ClickUp as tasks
 * @param {Array} taggedFiles - Array of tagged files from drive-manager
 * @returns {Promise<Array>} Array of created/updated tasks
 */
async function mirrorFilesToClickUp(taggedFiles) {
  try {
    logger.info('Starting ClickUp mirroring operation...');
    
    // Get ClickUp credentials from vault
    const clickupCreds = vault.getClickUpCredentials();
    if (!clickupCreds || !clickupCreds.apiKey || !clickupCreds.workspaceId) {
      throw new Error('Missing ClickUp credentials');
    }
    
    // Get existing tasks to avoid duplicates
    const existingTasks = await getExistingTasks();
    const existingTaskMap = createTaskMap(existingTasks);
    
    // Get or create the main list for file tasks
    const mainList = await getOrCreateMainList(clickupCreds);
    
    // Process files and create/update tasks
    const results = [];
    
    for (const file of taggedFiles) {
      try {
        // Check if task already exists for this file
        const existingTask = existingTaskMap[file.id];
        
        if (existingTask) {
          // Update existing task
          const updatedTask = await updateTask(existingTask.id, file, clickupCreds);
          results.push({
            action: 'updated',
            fileId: file.id,
            taskId: existingTask.id,
            task: updatedTask
          });
        } else {
          // Create new task
          const newTask = await createTask(file, mainList.id, clickupCreds);
          results.push({
            action: 'created',
            fileId: file.id,
            taskId: newTask.id,
            task: newTask
          });
        }
      } catch (error) {
        logger.error(`Failed to process file ${file.name}: ${error.message}`);
      }
    }
    
    // Update task index
    await saveTaskIndex(results);
    
    // Update task count cache
    taskCountCache = results.length;
    lastSyncTime = new Date();
    
    logger.success(`ClickUp mirroring complete. Created/updated ${results.length} tasks`);
    return results;
  } catch (error) {
    logger.error(`ClickUp mirroring failed: ${error.message}`);
    logger.error(error.stack);
    return [];
  }
}

/**
 * Get existing tasks from ClickUp
 * @returns {Promise<Array>} Array of existing tasks
 */
async function getExistingTasks() {
  try {
    // First check if we have a local cache
    if (fs.existsSync(TASK_INDEX_PATH)) {
      const taskIndex = JSON.parse(fs.readFileSync(TASK_INDEX_PATH, 'utf8'));
      return taskIndex.tasks || [];
    }
    
    return [];
  } catch (error) {
    logger.error(`Failed to get existing tasks: ${error.message}`);
    return [];
  }
}

/**
 * Create a map of file ID to task
 * @param {Array} tasks - Array of tasks
 * @returns {Object} Map of file ID to task
 */
function createTaskMap(tasks) {
  const map = {};
  
  for (const task of tasks) {
    if (task.fileId) {
      map[task.fileId] = task;
    }
  }
  
  return map;
}

/**
 * Get or create the main list for file tasks
 * @param {Object} clickupCreds - ClickUp credentials
 * @returns {Promise<Object>} Main list
 */
async function getOrCreateMainList(clickupCreds) {
  try {
    // Get spaces in the workspace
    const spacesResponse = await axios.get(
      `https://api.clickup.com/api/v2/team/${clickupCreds.workspaceId}/space`,
      {
        headers: {
          'Authorization': clickupCreds.apiKey
        }
      }
    );
    
    // Find or create the IMMORTAL STACK space
    let immortalSpace = spacesResponse.data.spaces.find(
      space => space.name === 'IMMORTAL STACK'
    );
    
    if (!immortalSpace) {
      // Create the space
      const createSpaceResponse = await axios.post(
        `https://api.clickup.com/api/v2/team/${clickupCreds.workspaceId}/space`,
        {
          name: 'IMMORTAL STACK',
          multiple_assignees: true
        },
        {
          headers: {
            'Authorization': clickupCreds.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      immortalSpace = createSpaceResponse.data;
      logger.info(`Created IMMORTAL STACK space: ${immortalSpace.id}`);
    }
    
    // Get folders in the space
    const foldersResponse = await axios.get(
      `https://api.clickup.com/api/v2/space/${immortalSpace.id}/folder`,
      {
        headers: {
          'Authorization': clickupCreds.apiKey
        }
      }
    );
    
    // Find or create the Drive Files folder
    let driveFolder = foldersResponse.data.folders.find(
      folder => folder.name === 'Drive Files'
    );
    
    if (!driveFolder) {
      // Create the folder
      const createFolderResponse = await axios.post(
        `https://api.clickup.com/api/v2/space/${immortalSpace.id}/folder`,
        {
          name: 'Drive Files'
        },
        {
          headers: {
            'Authorization': clickupCreds.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      driveFolder = createFolderResponse.data;
      logger.info(`Created Drive Files folder: ${driveFolder.id}`);
    }
    
    // Get lists in the folder
    const listsResponse = await axios.get(
      `https://api.clickup.com/api/v2/folder/${driveFolder.id}/list`,
      {
        headers: {
          'Authorization': clickupCreds.apiKey
        }
      }
    );
    
    // Find or create the File Tasks list
    let fileTasksList = listsResponse.data.lists.find(
      list => list.name === 'File Tasks'
    );
    
    if (!fileTasksList) {
      // Create the list
      const createListResponse = await axios.post(
        `https://api.clickup.com/api/v2/folder/${driveFolder.id}/list`,
        {
          name: 'File Tasks',
          content: 'Tasks mirrored from Google Drive files by IMMORTAL-CORD'
        },
        {
          headers: {
            'Authorization': clickupCreds.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      fileTasksList = createListResponse.data;
      logger.info(`Created File Tasks list: ${fileTasksList.id}`);
    }
    
    return fileTasksList;
  } catch (error) {
    logger.error(`Failed to get or create main list: ${error.message}`);
    throw error;
  }
}

/**
 * Create a task in ClickUp
 * @param {Object} file - File object
 * @param {string} listId - ClickUp list ID
 * @param {Object} clickupCreds - ClickUp credentials
 * @returns {Promise<Object>} Created task
 */
async function createTask(file, listId, clickupCreds) {
  try {
    // Format task description
    const description = formatTaskDescription(file);
    
    // Format task name
    const taskName = `${file.name} [${file.mimeType.split('/').pop()}]`;
    
    // Create task
    const response = await axios.post(
      `https://api.clickup.com/api/v2/list/${listId}/task`,
      {
        name: taskName,
        description: description,
        tags: file.tags,
        custom_fields: [
          {
            name: 'File ID',
            value: file.id
          },
          {
            name: 'File Type',
            value: file.mimeType
          }
        ]
      },
      {
        headers: {
          'Authorization': clickupCreds.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Created task for file: ${file.name}`);
    
    // Add file ID to task
    const task = response.data;
    task.fileId = file.id;
    
    return task;
  } catch (error) {
    logger.error(`Failed to create task for file ${file.name}: ${error.message}`);
    throw error;
  }
}

/**
 * Update a task in ClickUp
 * @param {string} taskId - ClickUp task ID
 * @param {Object} file - File object
 * @param {Object} clickupCreds - ClickUp credentials
 * @returns {Promise<Object>} Updated task
 */
async function updateTask(taskId, file, clickupCreds) {
  try {
    // Format task description
    const description = formatTaskDescription(file);
    
    // Format task name
    const taskName = `${file.name} [${file.mimeType.split('/').pop()}]`;
    
    // Update task
    const response = await axios.put(
      `https://api.clickup.com/api/v2/task/${taskId}`,
      {
        name: taskName,
        description: description,
        tags: file.tags
      },
      {
        headers: {
          'Authorization': clickupCreds.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    logger.info(`Updated task for file: ${file.name}`);
    
    // Add file ID to task
    const task = response.data;
    task.fileId = file.id;
    
    return task;
  } catch (error) {
    logger.error(`Failed to update task for file ${file.name}: ${error.message}`);
    throw error;
  }
}

/**
 * Format task description
 * @param {Object} file - File object
 * @returns {string} Formatted description
 */
function formatTaskDescription(file) {
  return `
# File: ${file.name}

**Type:** ${file.mimeType}
**Location:** ${file.folderPath || 'Root'}
**Created:** ${new Date(file.createdTime).toLocaleString()}
**Modified:** ${new Date(file.modifiedTime).toLocaleString()}
${file.size ? `**Size:** ${formatFileSize(file.size)}` : ''}

## Tags
${file.tags.map(tag => `- ${tag}`).join('\n')}

## Links
[Open in Google Drive](${file.webViewLink})

---
*This task was automatically created by IMMORTAL-CORD*
*Last updated: ${new Date().toLocaleString()}*
`;
}

/**
 * Format file size
 * @param {number} size - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(size) {
  const sizeInKB = size / 1024;
  
  if (sizeInKB < 1024) {
    return `${sizeInKB.toFixed(2)} KB`;
  }
  
  const sizeInMB = sizeInKB / 1024;
  
  if (sizeInMB < 1024) {
    return `${sizeInMB.toFixed(2)} MB`;
  }
  
  const sizeInGB = sizeInMB / 1024;
  return `${sizeInGB.toFixed(2)} GB`;
}

/**
 * Save task index to file
 * @param {Array} tasks - Array of tasks
 */
async function saveTaskIndex(tasks) {
  try {
    // Ensure vault directory exists
    if (!fs.existsSync(VAULT_DIR)) {
      fs.mkdirSync(VAULT_DIR, { recursive: true });
    }
    
    // Create task index
    const taskIndex = {
      generatedAt: new Date().toISOString(),
      totalTasks: tasks.length,
      tasks: tasks
    };
    
    // Write task index to file
    fs.writeFileSync(TASK_INDEX_PATH, JSON.stringify(taskIndex, null, 2));
    logger.info(`Task index saved to ${TASK_INDEX_PATH}`);
    
    return TASK_INDEX_PATH;
  } catch (error) {
    logger.error(`Failed to save task index: ${error.message}`);
    return null;
  }
}

/**
 * Get task count
 * @returns {Promise<number>} Number of tasks
 */
async function getTaskCount() {
  try {
    // If we have a recent cache, use it
    if (taskCountCache !== null && lastSyncTime !== null) {
      const now = new Date();
      const hoursSinceLastSync = (now - lastSyncTime) / (1000 * 60 * 60);
      
      if (hoursSinceLastSync < 1) {
        return taskCountCache;
      }
    }
    
    // Otherwise, check the task index file
    if (fs.existsSync(TASK_INDEX_PATH)) {
      const taskIndex = JSON.parse(fs.readFileSync(TASK_INDEX_PATH, 'utf8'));
      taskCountCache = taskIndex.totalTasks;
      return taskCountCache;
    }
    
    return 0;
  } catch (error) {
    logger.error(`Failed to get task count: ${error.message}`);
    return 0;
  }
}

module.exports = {
  mirrorFilesToClickUp,
  getTaskCount
};
