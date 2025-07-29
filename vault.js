/**
 * IMMORTAL-CORD: Central Execution Engine
 * vault.js - Secure credential management
 * 
 * This module handles loading and securing API keys and credentials
 * from the .env file, and provides methods to verify API connections.
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const axios = require('axios');
const logger = require('./logger');

// Store loaded credentials
const credentials = {
  drive: null,
  clickup: null,
  stripe: null,
  render: null,
  discord: null
};

/**
 * Load environment variables
 */
async function loadEnvironment() {
  try {
    logger.info('Loading environment variables...');
    
    // Check if .env file exists
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
      logger.error('.env file not found. Please create one based on .env.template');
      return { loaded: false, error: '.env file not found' };
    }
    
    // Check required environment variables
    const requiredVars = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
      'CLICKUP_API_KEY',
      'CLICKUP_WORKSPACE_ID'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      return { loaded: false, error: `Missing required variables: ${missingVars.join(', ')}` };
    }
    
    // Load Google Drive credentials
    credentials.drive = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN
    };
    
    // Load ClickUp credentials
    credentials.clickup = {
      apiKey: process.env.CLICKUP_API_KEY,
      workspaceId: process.env.CLICKUP_WORKSPACE_ID
    };
    
    // Load optional Stripe credentials
    if (process.env.STRIPE_SECRET_KEY) {
      credentials.stripe = {
        secretKey: process.env.STRIPE_SECRET_KEY
      };
    }
    
    // Load optional Render credentials
    if (process.env.RENDER_API_KEY) {
      credentials.render = {
        apiKey: process.env.RENDER_API_KEY
      };
    }
    
    // Load optional Discord credentials
    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_WEBHOOK_URL) {
      credentials.discord = {
        botToken: process.env.DISCORD_BOT_TOKEN,
        webhookUrl: process.env.DISCORD_WEBHOOK_URL
      };
    }
    
    logger.info('Environment variables loaded successfully');
    return { loaded: true };
    
  } catch (error) {
    logger.error(`Failed to load environment: ${error.message}`);
    logger.error(error.stack);
    return { loaded: false, error: error.message };
  }
}

/**
 * Verify API connections
 */
async function verifyConnections() {
  const status = {
    drive: { status: false, message: 'Not checked' },
    clickup: { status: false, message: 'Not checked' }
  };
  
  // Add optional services if configured
  if (credentials.stripe) {
    status.stripe = { status: false, message: 'Not checked' };
  }
  
  if (credentials.render) {
    status.render = { status: false, message: 'Not checked' };
  }
  
  // Check Google Drive connection
  try {
    logger.info('Verifying Google Drive connection...');
    
    const oauth2Client = new google.auth.OAuth2(
      credentials.drive.clientId,
      credentials.drive.clientSecret
    );
    
    oauth2Client.setCredentials({
      refresh_token: credentials.drive.refreshToken
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Test API by listing files
    const response = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)'
    });
    
    status.drive = {
      status: true,
      message: 'Connected successfully'
    };
    
    logger.info('Google Drive connection verified successfully');
    
  } catch (error) {
    logger.error(`Google Drive connection failed: ${error.message}`);
    status.drive = {
      status: false,
      message: `Connection failed: ${error.message}`
    };
  }
  
  // Check ClickUp connection
  try {
    logger.info('Verifying ClickUp connection...');
    
    const response = await axios.get(
      `https://api.clickup.com/api/v2/team/${credentials.clickup.workspaceId}`,
      {
        headers: {
          'Authorization': credentials.clickup.apiKey
        }
      }
    );
    
    status.clickup = {
      status: true,
      message: `Connected to workspace: ${response.data.team.name}`
    };
    
    logger.info('ClickUp connection verified successfully');
    
  } catch (error) {
    logger.error(`ClickUp connection failed: ${error.message}`);
    status.clickup = {
      status: false,
      message: `Connection failed: ${error.message}`
    };
  }
  
  // Check Stripe connection if configured
  if (credentials.stripe) {
    try {
      logger.info('Verifying Stripe connection...');
      
      const stripe = require('stripe')(credentials.stripe.secretKey);
      const account = await stripe.account.retrieve();
      
      status.stripe = {
        status: true,
        message: `Connected to Stripe account: ${account.email}`
      };
      
      logger.info('Stripe connection verified successfully');
      
    } catch (error) {
      logger.error(`Stripe connection failed: ${error.message}`);
      status.stripe = {
        status: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
  
  // Check Render connection if configured
  if (credentials.render) {
    try {
      logger.info('Verifying Render connection...');
      
      const response = await axios.get(
        'https://api.render.com/v1/services',
        {
          headers: {
            'Authorization': `Bearer ${credentials.render.apiKey}`
          }
        }
      );
      
      status.render = {
        status: true,
        message: `Connected to Render: ${response.data.length} services found`
      };
      
      logger.info('Render connection verified successfully');
      
    } catch (error) {
      logger.error(`Render connection failed: ${error.message}`);
      status.render = {
        status: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
  
  return status;
}

/**
 * Get Google Drive client
 */
function getDriveClient() {
  try {
    const oauth2Client = new google.auth.OAuth2(
      credentials.drive.clientId,
      credentials.drive.clientSecret
    );
    
    oauth2Client.setCredentials({
      refresh_token: credentials.drive.refreshToken
    });
    
    return google.drive({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    logger.error(`Failed to create Drive client: ${error.message}`);
    throw error;
  }
}

/**
 * Get ClickUp API key
 */
function getClickUpCredentials() {
  return {
    apiKey: credentials.clickup.apiKey,
    workspaceId: credentials.clickup.workspaceId
  };
}

/**
 * Get Stripe client (if configured)
 */
function getStripeClient() {
  if (!credentials.stripe) {
    logger.warn('Stripe credentials not configured');
    return null;
  }
  
  try {
    const stripe = require('stripe')(credentials.stripe.secretKey);
    return stripe;
  } catch (error) {
    logger.error(`Failed to create Stripe client: ${error.message}`);
    return null;
  }
}

module.exports = {
  loadEnvironment,
  verifyConnections,
  getDriveClient,
  getClickUpCredentials,
  getStripeClient
};
