import fs from 'fs';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve('./server/data');
const PORT_FILE_DIRS = ['public', 'dist'];
const FALLBACK_CHAMPIONS = [
  'Ashe',
  'Darius',
  'Evelynn',
  'Garen',
  'Jinx',
  'Leona',
  'Lux',
  'Maokai',
  'Sona',
  'Yasuo',
  'Annie',
  'Braum',
  'Caitlyn',
  'DrMundo',
  'Janna',
  'Karma',
  'Malphite',
  'Nami',
  'Rammus',
  'Zed'
];
const CHAMPION_IDS = [];
let INITIAL_UNLOCKED = [];
const STARTING_CHAMPION_COUNT = 10;
const SUMMONER_SPELLS = ['Flash', 'Ghost', 'Heal', 'Ignite', 'Exhaust', 'Barrier', 'Cleanse', 'Mark/Dash (Snowball)'];

const sessions = new Map();
fs.mkdirSync(DATA_DIR, { recursive: true });

async function loadChampionPool() {
  try {
    const versionResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!versionResponse.ok) {
      throw new Error('Failed to fetch Data Dragon versions');
    }
    const versions = await versionResponse.json();
    const latestVersion = versions[0];
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
    if (!response.ok) {
      throw new Error('Failed to fetch champion data');
    }
    const payload = await response.json();
    return Object.values(payload.data).map((item) => item.id);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to load champion pool from Data Dragon, falling back to default champion set.', error);
    return FALLBACK_CHAMPIONS;
  }
}

async function ensureChampionPool() {
  if (CHAMPION_IDS.length > 0) {
    return;
  }
  const list = await loadChampionPool();
  CHAMPION_IDS.push(...list);
  INITIAL_UNLOCKED = shuffleArray(CHAMPION_IDS).slice(0, 10);
}

function saveServerPort(port) {
  PORT_FILE_DIRS.forEach((dir) => {
    const absDir = path.resolve(process.cwd(), dir);
    if (fs.existsSync(absDir)) {
      fs.writeFileSync(path.join(absDir, 'server-port.json'), JSON.stringify({ port }, null, 2));
    }
  });
}

function shuffleArray(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function chooseRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function sessionFilePath(sessionId) {
  return path.join(DATA_DIR, `${sessionId}.json`);
}

function saveSession(session) {
  const payload = {
    sessionId: session.sessionId,
    phase: session.phase,
    hostId: session.hostId,
    maxPlayers: session.maxPlayers,
    players: session.players,
    goals: session.goals,
    unlockedChampionIds: session.unlockedChampionIds,
    lockedChampionIds: session.lockedChampionIds,
    lastUpdated: session.lastUpdated
  };
  fs.writeFileSync(sessionFilePath(session.sessionId), JSON.stringify(payload, null, 2));
}

function loadSession(sessionId) {
  const filePath = sessionFilePath(sessionId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const json = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
}

function buildSession(sessionId) {
  const shuffled = shuffleArray(CHAMPION_IDS);

  return {
    sessionId,
    phase: 'lobby',
    hostId: null,
    maxPlayers: 5,
    players: [],
    goals: [],
    unlockedChampionIds: shuffled.slice(0, 10),
    lockedChampionIds: shuffled.slice(10),
    lastUpdated: Date.now(),
    clients: new Set()
  };
}

function findSession(sessionId) {
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId);
  }

  const loaded = loadSession(sessionId);
  const session = loaded
    ? { ...loaded, clients: new Set() }
    : buildSession(sessionId);

  if (loaded) {
    upgradeSessionPlayers(session);
    saveSession(session);
  }

  sessions.set(sessionId, session);
  return session;
}

function createGoalForChampion(player, session, championId, goalType) {
  const goalTemplates = {
    win: (champ) => `Win a game while playing ${champ} using ${chooseRandom(SUMMONER_SPELLS)}`,
    killsAssists: (champ) => `Get 15 kills or assists with ${champ}`,
    cs: (champ) => `Reach 50 CS with ${champ}`,
    multikill: (champ) => `Score a triple kill with ${champ}`
  };

  const description = goalTemplates[goalType] ? goalTemplates[goalType](championId) : '';
  const unlockChampionId = session.lockedChampionIds.length ? chooseRandom(session.lockedChampionIds) : null;
  const unlockForPlayerId = session.players.length ? chooseRandom(session.players).id : player.id;

  return {
    id: randomId(),
    playerId: player.id,
    type: goalType,
    description,
    championId,
    completed: false,
    unlockChampionId,
    unlockForPlayerId
  };
}

function refreshGoals(session) {
  const existingGoals = new Map();
  session.goals.forEach((goal) => {
    const key = `${goal.playerId}-${goal.championId}-${goal.type}`;
    existingGoals.set(key, goal);
  });

  const newGoals = [];
  session.players.forEach((player) => {
    const goalTypes = ['win', 'killsAssists', 'cs', 'multikill'];
    player.unlockedChampionIds.forEach((championId) => {
      goalTypes.forEach((goalType) => {
        const key = `${player.id}-${championId}-${goalType}`;
        if (!existingGoals.has(key)) {
          newGoals.push(createGoalForChampion(player, session, championId, goalType));
        }
      });
    });
  });

  session.goals.push(...newGoals);
}

function createGoalForPlayer(player, session) {
  const goalTypes = [
    { type: 'win', template: (champ) => `Win a game while playing ${champ} using ${chooseRandom(SUMMONER_SPELLS)}` },
    { type: 'killsAssists', template: (champ) => `Get 15 kills or assists with ${champ}` },
    { type: 'cs', template: (champ) => `Reach 50 CS with ${champ}` },
    { type: 'multikill', template: (champ) => `Score a triple kill with ${champ}` }
  ];

  const template = chooseRandom(goalTypes);
  const candidateChampions = player.unlockedChampionIds.length ? player.unlockedChampionIds : session.unlockedChampionIds;
  const championId = chooseRandom(candidateChampions);
  const unlockChampionId = session.lockedChampionIds.length ? chooseRandom(session.lockedChampionIds) : null;
  const unlockForPlayerId = session.players.length ? chooseRandom(session.players).id : player.id;

  return {
    id: randomId(),
    playerId: player.id,
    type: template.type,
    description: template.template(championId),
    championId,
    completed: false,
    unlockChampionId,
    unlockForPlayerId
  };
}

function upgradeSessionPlayers(session) {
  session.players = session.players.map((player) => {
    const existing = Array.isArray(player.unlockedChampionIds) ? [...new Set(player.unlockedChampionIds)] : [];
    const currentIds = new Set(existing);
    while (currentIds.size < STARTING_CHAMPION_COUNT) {
      currentIds.add(chooseRandom(CHAMPION_IDS));
    }
    return {
      ...player,
      unlockedChampionIds: Array.from(currentIds)
    };
  });
}

function assignStartingChampionIds(session, count) {
  const assigned = new Set(session.players.flatMap((player) => player.unlockedChampionIds));
  const available = CHAMPION_IDS.filter((championId) => !assigned.has(championId));
  const picked = [];
  const pool = [...CHAMPION_IDS];

  while (picked.length < count && available.length) {
    const index = Math.floor(Math.random() * available.length);
    picked.push(available.splice(index, 1)[0]);
  }

  while (picked.length < count) {
    const remaining = pool.filter((championId) => !picked.includes(championId));
    if (!remaining.length) {
      picked.push(chooseRandom(CHAMPION_IDS));
      continue;
    }
    const index = Math.floor(Math.random() * remaining.length);
    picked.push(remaining.splice(index, 1)[0]);
  }

  return picked;
}

function addPlayerToSession(session, playerName) {
  if (session.players.length >= session.maxPlayers) {
    return null;
  }

  const playerId = randomId();
  const unlockedChampionIds = assignStartingChampionIds(session, STARTING_CHAMPION_COUNT);
  const player = {
    id: playerId,
    name: playerName,
    unlockedChampionIds
  };

  session.players.push(player);
  if (!session.hostId) {
    session.hostId = playerId;
  }
  session.lastUpdated = Date.now();
  saveSession(session);

  return player;
}

function startSession(session, playerId) {
  if (session.phase === 'active') {
    return false;
  }
  if (session.hostId !== playerId) {
    return false;
  }

  session.players.forEach((player) => {
    if (!player.unlockedChampionIds.length) {
      player.unlockedChampionIds = assignStartingChampionIds(session, STARTING_CHAMPION_COUNT);
    }
  });

  session.phase = 'active';
  refreshGoals(session);
  session.lastUpdated = Date.now();
  saveSession(session);

  return true;
}

function applyUnlock(session, goal) {
  if (!goal.unlockChampionId || !goal.unlockForPlayerId) return;
  const unlockIndex = session.lockedChampionIds.indexOf(goal.unlockChampionId);
  if (unlockIndex < 0) return;

  session.lockedChampionIds.splice(unlockIndex, 1);
  session.unlockedChampionIds.push(goal.unlockChampionId);

  const target = session.players.find((player) => player.id === goal.unlockForPlayerId);
  if (target && !target.unlockedChampionIds.includes(goal.unlockChampionId)) {
    target.unlockedChampionIds.push(goal.unlockChampionId);
  }
}

function completeGoal(session, playerId, goalId) {
  const goal = session.goals.find((item) => item.id === goalId);
  if (!goal || goal.completed || goal.playerId !== playerId) {
    return false;
  }

  goal.completed = true;
  applyUnlock(session, goal);

  const player = session.players.find((item) => item.id === playerId);
  if (player) {
    session.goals.push(createGoalForPlayer(player, session));
  }

  session.lastUpdated = Date.now();
  saveSession(session);
  return true;
}

function getRegionFromMatchId(matchId) {
  const [platform] = matchId.split('_');
  const regionMap = {
    NA1: 'americas',
    BR1: 'americas',
    LA1: 'americas',
    LA2: 'americas',
    OC1: 'americas',
    JP1: 'asia',
    KR: 'asia',
    EUN1: 'europe',
    EUW1: 'europe',
    TR1: 'europe',
    RU: 'europe'
  };
  return regionMap[platform] || 'americas';
}

function normalizeChampionName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function verifyMatchGoal(session, playerId, goalId, matchId, apiKey) {
  const goal = session.goals.find((item) => item.id === goalId);
  if (!goal || goal.completed || goal.playerId !== playerId) {
    return { success: false, message: 'Goal not found or already completed.' };
  }

  const player = session.players.find((item) => item.id === playerId);
  if (!player) {
    return { success: false, message: 'Player not found.' };
  }

  if (!apiKey) {
    return { success: false, message: 'Riot API key is required for verification.' };
  }

  const region = getRegionFromMatchId(matchId);
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'X-Riot-Token': apiKey
      }
    });

    if (!response.ok) {
      return { success: false, message: `Riot API request failed: ${response.status}` };
    }

    const matchData = await response.json();
    const participant = matchData.info.participants.find(
      (item) => item.summonerName?.toLowerCase() === player.name.toLowerCase()
    );

    if (!participant) {
      return { success: false, message: 'Could not find your summoner name in the match data.' };
    }

    if (normalizeChampionName(participant.championName) !== normalizeChampionName(goal.championId)) {
      return {
        success: false,
        message: `The match champion (${participant.championName}) does not match the goal champion (${goal.championId}).`
      };
    }

    let valid = false;
    switch (goal.type) {
      case 'killsAssists':
        valid = participant.kills + participant.assists >= 15;
        break;
      case 'cs':
        valid = participant.totalMinionsKilled + participant.neutralMinionsKilled >= 120;
        break;
      case 'multikill':
        valid = participant.largestMultiKill >= 3;
        break;
      case 'killstreak':
        valid = participant.largestKillingSpree >= 3;
        break;
      case 'win':
        valid = participant.win === true;
        break;
      default:
        valid = false;
    }

    if (!valid) {
      return { success: false, message: 'The match results did not satisfy the current goal.' };
    }

    const completed = completeGoal(session, playerId, goalId);
    if (!completed) {
      return { success: false, message: 'The goal could not be marked complete.' };
    }

    broadcastSession(session);
    return { success: true, message: 'Goal verified and completed successfully.' };
  } catch (error) {
    return { success: false, message: 'Unable to verify the match with the Riot API.' };
  }
}

function broadcastSession(session) {
  const payload = JSON.stringify({ type: 'sessionUpdate', payload: session });
  session.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  });
}

function getSavedSessionMetadata() {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }

  return fs.readdirSync(DATA_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        return {
          sessionId: data.sessionId,
          phase: data.phase,
          hostId: data.hostId,
          playerCount: data.players?.length ?? 0,
          lastUpdated: data.lastUpdated
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const distPath = path.join(__dirname, '..', 'dist');

  if (req.method === 'GET' && url.pathname === '/sessions') {
    const sessions = getSavedSessionMetadata();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(sessions));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/sessions/')) {
    const sessionId = decodeURIComponent(url.pathname.replace('/sessions/', ''));
    const saved = loadSession(sessionId);
    if (!saved) {
      res.writeHead(404, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(saved));
    return;
  }

  if (req.method === 'GET') {
    let filePath = path.join(distPath, url.pathname);

    if (filePath.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif'
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(fs.readFileSync(filePath));
      return;
    }

    if (fs.existsSync(path.join(distPath, 'index.html'))) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(distPath, 'index.html')));
      return;
    }
  }

  res.writeHead(404, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
  const sessionId = query.get('sessionId');
  const playerName = query.get('name');

  if (!sessionId || !playerName) {
    ws.send(JSON.stringify({ type: 'error', payload: 'Missing sessionId or name' }));
    ws.close();
    return;
  }

  const session = findSession(sessionId);
  session.clients.add(ws);

  const player = addPlayerToSession(session, playerName);
  if (!player) {
    ws.send(JSON.stringify({ type: 'error', payload: 'This session is full.' }));
    ws.close();
    return;
  }

  ws.send(JSON.stringify({ type: 'joined', payload: { playerId: player.id, state: session } }));
  broadcastSession(session);

  ws.on('message', async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'completeGoal') {
        completeGoal(session, player.id, message.payload.goalId);
        broadcastSession(session);
      }

      if (message.type === 'startSession') {
        startSession(session, player.id);
        broadcastSession(session);
      }

      if (message.type === 'verifyMatch') {
        const result = await verifyMatchGoal(
          session,
          player.id,
          message.payload.goalId,
          message.payload.matchId,
          message.payload.apiKey
        );
        ws.send(JSON.stringify({ type: 'verifyResult', payload: result }));
      }

      if (message.type === 'requestState') {
        ws.send(JSON.stringify({ type: 'sessionUpdate', payload: session }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', payload: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    session.clients.delete(ws);
  });
});

function startServer(port) {
  server.listen(port, HOST, () => {
    const actualPort = server.address().port;
    saveServerPort(actualPort);
    // eslint-disable-next-line no-console
    console.log(`Real-time session server started on ws://${HOST}:${actualPort}`);
  });
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.warn(`Port ${PORT} is already in use.`);
    process.exit(1);
  }
  throw error;
});

await ensureChampionPool();
startServer(PORT);
