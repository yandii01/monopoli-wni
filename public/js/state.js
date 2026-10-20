// =========================================================================
// CLIENT-SIDE GLOBAL STATE STORE
// =========================================================================

let currentAppRole = 'laptop';
let wsClient = null;
let currentRoomCode = '';
let myPlayerId = -1;
let myMobilePhoto = null;

let tiles = [];
let players = [];
let activePlayerIdx = 0;
let roundNumber = 1;
let isMoving = false;
let isGameStarted = false;

let doubleCount = 0;
let turnSecondsLeft = 15;
let turnTimerInterval = null;

let activeGoblinTile = null;
let globalActivityLogs = [];
let myPersonalActivityLogs = [];
let pendingActionType = 'BUY'; // 'BUY', 'UPGRADE', 'TAKEOVER'

function addGlobalActivityLog(text) {
  globalActivityLogs.unshift(text);
  if (globalActivityLogs.length > 50) globalActivityLogs.pop();
  if (currentAppRole === 'laptop') {
    renderLaptopGlobalHistoryUI();
  }
}

function addPersonalActivityLog(text) {
  myPersonalActivityLogs.unshift(text);
  if (myPersonalActivityLogs.length > 50) myPersonalActivityLogs.pop();
  if (currentAppRole === 'mobile') {
    renderMobilePersonalHistoryUI();
  }
}
