// Clickup-Manager.js
const axios = require('axios');

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_WORKSPACE_ID = process.env.CLICKUP_WORKSPACE_ID;

async function getClickUpTeams() {
  try {
    const res = await axios.get(`${CLICKUP_API_BASE}/team`, {
      headers: { Authorization: CLICKUP_TOKEN }
    });
    return res.data.teams;
  } catch (err) {
    console.error('Failed to get ClickUp teams:', err.message);
    return null;
  }
}

async function createTask(listId, taskName, taskDesc = '') {
  try {
    const res = await axios.post(`${CLICKUP_API_BASE}/list/${listId}/task`, {
      name: taskName,
      description: taskDesc
    }, {
      headers: { Authorization: CLICKUP_TOKEN }
    });

    return res.data;
  } catch (err) {
    console.error('ClickUp Task Creation Failed:', err.response?.data || err.message);
    return null;
  }
}

async function testClickupConnection() {
  const teams = await getClickUpTeams();
  if (teams && teams.length > 0) {
    return { success: true, teams };
  } else {
    return { success: false, message: 'No teams returned or invalid token' };
  }
}

module.exports = {
  getClickUpTeams,
  createTask,
  testClickupConnection
};
