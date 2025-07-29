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
