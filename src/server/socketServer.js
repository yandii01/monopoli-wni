const { WebSocketServer } = require('ws');
const { getLocalIp, PORT } = require('../config');
const gameHandler = require('./gameHandler');

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });
  const localIp = getLocalIp();

  wss.on('connection', (ws) => {
    const state = {
      currentRoom: null,
      playerRecord: null,
      isBoardDisplay: false
    };

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'CREATE_BOARD_DISPLAY':
            gameHandler.handleCreateBoardDisplay(ws, data, state, localIp, PORT);
            break;
          case 'JOIN_ROOM':
            gameHandler.handleJoinRoom(ws, data, state, localIp, PORT);
            break;
          case 'START_GAME':
            gameHandler.handleStartGame(ws, data, state);
            break;
          case 'DICE_ROLLED':
            gameHandler.handleDiceRolled(ws, data, state);
            break;
          case 'PLAYER_MISSED_TURN':
            gameHandler.handlePlayerMissedTurn(ws, data, state);
            break;
          case 'SYNC_STATE':
            gameHandler.handleSyncState(ws, data, state);
            break;
          case 'ACTION_BUY_PROPERTY':
            gameHandler.handleBuyProperty(ws, data, state);
            break;
          case 'ACTION_BUILD_PROPERTY':
            gameHandler.handleBuildProperty(ws, data, state);
            break;
          case 'ACTION_SELL_PROPERTY':
            gameHandler.handleSellProperty(ws, data, state);
            break;
          case 'ACTION_CLAIM_GOBLIN':
            gameHandler.handleClaimGoblin(ws, data, state);
            break;
          case 'ACTION_BANKRUPT':
            gameHandler.handleBankrupt(ws, data, state);
            break;
          case 'ACTION_END_TURN':
            gameHandler.handleEndTurn(ws, data, state);
            break;
          case 'LEAVE_ROOM':
            gameHandler.handleLeaveRoom(ws, data, state);
            break;
          default:
            console.warn('Unknown message type received:', data.type);
            break;
        }
      } catch (e) {
        console.error('Socket message parse error:', e);
      }
    });

    ws.on('close', () => {
      gameHandler.handleDisconnect(ws, state);
    });
  });

  return wss;
}

module.exports = {
  setupWebSocket
};
