/**
 * IMMORTAL-CORD System
 * Simplified Main System for Easy Deployment
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Memory storage path
const MEMORY_STORAGE_PATH = process.env.MEMORY_STORAGE_PATH || './memory-cord';

// Simple logging function
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
}

// ClickUp integration
let clickupManager;
try {
  clickupManager = require('./clickup-manager');
  log('info', 'ClickUp manager loaded successfully');
} catch (error) {
  log('warn', 'Could not load ClickUp manager', { error: error.message });
  // Create fallback clickupManager with empty methods
  clickupManager = {
    syncTasks: async () => ({ message: "ClickUp manager not available" })
  };
}

// Google Drive integration
let driveManager;
try {
  driveManager = require('./drive-manager');
  log('info', 'Google Drive manager loaded successfully');
} catch (error) {
  log('warn', 'Could not load Google Drive manager', { error: error.message });
  // Create fallback driveManager with empty methods
  driveManager = {
    checkConnection: async () => ({ success: false, message: "Google Drive manager not available" }),
    listFiles: async () => ({ success: false, message: "Google Drive manager not available" }),
    scanFolder: async () => ({ success: false, message: "Google Drive manager not available" })
  };
}

/**
 * System Initialization
 */
async function initializeSystem() {
  try {
    log('info', 'IMMORTAL-CORD System initializing...');
    
    // Ensure memory directory exists
    try {
      await fs.mkdir(MEMORY_STORAGE_PATH, { recursive: true });
      log('info', `Memory directory created at ${MEMORY_STORAGE_PATH}`);
    } catch (error) {
      log('warn', `Could not create memory directory: ${error.message}`);
    }
    
    // Create initial memory if it doesn't exist
    await initializeMemory();
    
    // Start the heartbeat
    startHeartbeat();
    
    log('info', 'IMMORTAL-CORD System fully initialized');
  } catch (error) {
    log('error', 'System initialization failed', { error: error.message });
  }
}

// ... [rest of your existing code] ...

// Google Drive endpoints
app.get('/drive-status', async (req, res) => {
  try {
    log('info', 'Google Drive status check requested');
    const status = await driveManager.checkConnection();
    log('info', 'Google Drive status check completed');
    res.json(status);
  } catch (error) {
    log('error', 'Google Drive Status Check Error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/drive-files', async (req, res) => {
  try {
    log('info', 'Google Drive files listing requested');
    const { folderId, pageSize, query } = req.query;
    const options = { folderId, pageSize: pageSize ? parseInt(pageSize) : 10, query };
    const result = await driveManager.listFiles(options);
    log('info', 'Google Drive files listing completed');
    res.json(result);
  } catch (error) {
    log('error', 'Google Drive Files Listing Error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/drive-scan', async (req, res) => {
  try {
    log('info', 'Google Drive folder scan requested');
    const { folderId, depth } = req.query;
    
    if (!folderId) {
      return res.status(400).json({ success: false, error: 'Folder ID is required' });
    }
    
    const result = await driveManager.scanFolder(folderId, depth ? parseInt(depth) : 2);
    
    if (result) {
      log('info', 'Google Drive folder scan completed');
      res.json({ success: true, folder: result });
    } else {
      log('warn', 'Google Drive folder scan returned no results');
      res.status(404).json({ success: false, error: 'Folder not found or error occurred' });
    }
  } catch (error) {
    log('error', 'Google Drive Folder Scan Error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ... [rest of your existing code] ...
