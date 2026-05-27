<template>
  <div class="session-shell">
    <section class="hero-panel">
      <h1>ARAM Archipelago</h1>
      <p>Start a live session with friends, complete checks, and unlock new champions in real time.</p>
    </section>

    <section class="join-panel" v-if="!connected">
      <label for="player-name">Your name</label>
      <input id="player-name" v-model="name" type="text" placeholder="Summoner name" />

      <label for="session-id">Session code</label>
      <div class="session-row">
        <input id="session-id" v-model="sessionId" type="text" placeholder="Enter or create a session" />
        <button type="button" @click="sessionId = generateSessionId()">New</button>
      </div>

      <button class="primary-button" type="button" @click="joinSession" :disabled="connecting">
        {{ connecting ? 'Connecting…' : 'Join session' }}
      </button>
      <p class="hint" v-if="!isProduction">The session server runs locally on <code>ws://localhost:{{ serverPort }}</code>.</p>
      <p class="error-message" v-if="statusMessage">{{ statusMessage }}</p>

      <section class="saved-sessions-panel">
        <div class="saved-sessions-header">
          <h2>Saved sessions</h2>
          <button class="secondary-button" type="button" @click="fetchSavedSessions">Refresh</button>
        </div>
        <ul>
          <li v-for="item in savedSessions" :key="item.sessionId">
            <div class="session-row-list">
              <button class="session-link" type="button" @click="loadSavedSession(item.sessionId)">{{ item.sessionId }}</button>
              <span class="session-meta">{{ item.playerCount }} players • {{ item.phase }}</span>
            </div>
          </li>
        </ul>
      </section>
    </section>

    <section class="live-panel" v-else>
      <div class="status-bar">
        <div>
          <strong>Session:</strong> {{ session.sessionId }}
        </div>
        <div>
          <strong>Connected as:</strong> {{ name }}
        </div>
        <div>
          <strong>Last update:</strong> {{ formattedLastUpdated }}
        </div>
      </div>

      <div v-if="session.phase === 'lobby'" class="lobby-layout">
        <article class="players-panel">
          <h2>Lobby</h2>
          <p class="hint">Waiting for players to join. The host will start the session when everyone is ready.</p>
          <ul>
            <li v-for="player in session.players" :key="player.id" :class="{ current: player.id === currentPlayerId }">
              <div class="player-header">
                <strong>{{ player.name }}</strong>
                <span>{{ player.id === currentPlayerId ? 'You' : '' }}</span>
              </div>
              <div class="player-data">
                <div>
                  <span class="label">Unlocked</span>
                  <div class="champion-tags">
                    <span
                      v-for="championId in sortChampionIds(player.unlockedChampionIds)"
                      :key="championId"
                      class="champion-tag"
                    >
                      <img
                        class="champion-icon"
                        :src="getChampionImageUrlSafe(championId)"
                        :alt="getChampionName(championId)"
                        @error="onChampionImageError"
                      />
                      {{ getChampionName(championId) }}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </article>

        <aside class="lobby-actions">
          <h2>Ready to start</h2>
          <p>Session host: <strong>{{ getPlayerName(session.hostId) }}</strong></p>
          <button
            v-if="isHost"
            class="primary-button"
            type="button"
            @click="startSession"
            :disabled="session.players.length < 2"
          >
            Start session
          </button>
          <p class="hint">Share this session code with friends: <code>{{ session.sessionId }}</code></p>
          <p v-if="!isHost" class="hint">Only the session host can start the run.</p>
        </aside>
      </div>

      <div v-else class="grid-layout">
        <article class="players-panel">
          <h2>Players</h2>
          <ul>
            <li v-for="player in session.players" :key="player.id" :class="{ current: player.id === currentPlayerId }">
              <div class="player-header">
                <strong>{{ player.name }}</strong>
                <span>{{ player.id === currentPlayerId ? 'You' : '' }}</span>
              </div>
              <div class="player-data">
                <div>
                  <span class="label">Unlocked</span>
                  <div class="champion-tags">
                    <span
                      v-for="championId in sortChampionIds(player.unlockedChampionIds)"
                      :key="championId"
                      class="champion-tag"
                      :class="{
                        'champion-tag-clickable': player.id === currentPlayerId,
                        'champion-tag-selected': player.id === currentPlayerId && selectedChampionFilter.includes(championId)
                      }"
                      @click="player.id === currentPlayerId ? toggleChampionFilter(championId) : undefined"
                    >
                      <img
                        class="champion-icon"
                        :src="getChampionImageUrlSafe(championId)"
                        :alt="getChampionName(championId)"
                        @error="onChampionImageError"
                      />
                      {{ getChampionName(championId) }}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </article>

        <article class="goals-panel">
          <div class="goals-header">
            <h2>My Goals</h2>
            <div class="goals-tabs">
              <button
                class="tab-button"
                :class="{ active: !showCompletedGoals }"
                @click="showCompletedGoals = false"
              >
                Active
              </button>
              <button
                class="tab-button"
                :class="{ active: showCompletedGoals }"
                @click="showCompletedGoals = true"
              >
                Completed
              </button>
            </div>
          </div>
          <div v-if="selectedChampionFilter.length > 0" class="filter-bar">
            <span class="filter-bar-label">Filtered: {{ selectedChampionFilter.map(getChampionName).join(', ') }}</span>
            <button class="filter-clear-button" type="button" @click="clearChampionFilter">Show all</button>
          </div>

          <div v-if="!showCompletedGoals" class="goals-content">
            <ul>
              <li v-for="goal in currentPlayerOpenGoals" :key="goal.id" class="goal-item">
                <div class="goal-line">
                  <div>
                    <p class="goal-desc">{{ goal.description }}</p>
                    <div class="goal-meta">
                      <span>Champion: {{ getChampionName(goal.championId) }}</span>
                    </div>
                  </div>
                  <div class="goal-actions">
                    <button
                      class="primary-button"
                      type="button"
                      @click="completeGoal(goal.id)"
                      :disabled="goal.completed"
                    >
                      Mark complete
                    </button>
                    <button
                      class="secondary-button"
                      type="button"
                      @click="prepareVerification(goal.id)"
                      :disabled="goal.completed"
                    >
                      Verify with match
                    </button>
                  </div>
                </div>
                <div class="goal-reward" v-if="goal.unlockChampionId">
                  Unlocks {{ getChampionName(goal.unlockChampionId) }} for {{ getPlayerName(goal.unlockForPlayerId) }}
                </div>
              </li>
              <li v-if="!currentPlayerOpenGoals.length" class="goal-empty">No active goals.</li>
            </ul>
          </div>

          <div v-else class="goals-content">
            <ul>
              <li v-for="goal in currentPlayerCompletedGoals" :key="goal.id" class="goal-item completed">
                <div class="goal-line">
                  <div>
                    <p class="goal-desc">{{ goal.description }}</p>
                    <div class="goal-meta">
                      <span>Champion: {{ getChampionName(goal.championId) }}</span>
                    </div>
                  </div>
                </div>
                <div class="goal-reward" v-if="goal.unlockChampionId">
                  Unlocks {{ getChampionName(goal.unlockChampionId) }} for {{ getPlayerName(goal.unlockForPlayerId) }}
                </div>
              </li>
              <li v-if="!currentPlayerCompletedGoals.length" class="goal-empty">No completed goals yet.</li>
            </ul>
          </div>

          <div class="verification-panel" v-if="selectedGoalId">
            <h3>Verify goal with Riot match data</h3>
            <label for="match-id">Match ID</label>
            <input id="match-id" v-model="matchId" type="text" placeholder="Example: NA1_1234567890" />
            <label for="riot-key">Riot API key</label>
            <input id="riot-key" v-model="riotApiKey" type="text" placeholder="Enter your Riot API key" />
            <div class="verification-actions">
              <button class="primary-button" type="button" @click="verifySelectedGoal">Verify now</button>
              <button class="secondary-button" type="button" @click="cancelVerification">Cancel</button>
            </div>
            <p class="hint">Verification will attempt to confirm the current match details for your goal.</p>
            <p class="error-message" v-if="verificationMessage">{{ verificationMessage }}</p>
          </div>
        </article>

        <aside class="activity-log">
          <h2>Activity</h2>
          <ul class="activity-list">
            <li v-for="entry in activityLog" :key="entry.goalId" class="activity-entry">
              <div class="activity-header">
                <span class="activity-player">{{ entry.playerName }}</span>
                <span class="activity-time">{{ entry.time }}</span>
              </div>
              <p class="activity-desc">{{ entry.description }}</p>
              <div class="activity-unlock" v-if="entry.unlockChampionName">
                Unlocked {{ entry.unlockChampionName }} for {{ entry.unlockForPlayerName }}
              </div>
            </li>
            <li v-if="!activityLog.length" class="activity-empty">No completed goals yet.</li>
          </ul>
        </aside>
      </div>

      <section class="champion-pool-panel">
        <div class="champion-pool-header">
          <h2>Champion pool</h2>
          <input
            type="text"
            v-model="championFilter"
            placeholder="Filter champion pool"
            aria-label="Filter champion pool"
          />
        </div>
        <ul class="champion-list">
          <li v-for="entry in unlockedChampionEntries" :key="entry.championId" class="champion-tag">
            <img
              class="champion-icon"
              :src="getChampionImageUrlSafe(entry.championId)"
              :alt="getChampionName(entry.championId)"
              @error="onChampionImageError"
            />
            <div class="champion-details">
              <span>{{ getChampionName(entry.championId) }}</span>
              <small class="champion-owners">
                Unlocked by {{ entry.owners.length ? entry.owners.join(', ') : 'the session' }}
              </small>
            </div>
          </li>
        </ul>
      </section>

      <p class="note">If a goal is completed in your ARAM, tap the matching button or verify the match to sync the unlock across the session.</p>
    </section>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, reactive, ref } from 'vue';
import { fetchChampionList, getChampionImageUrl, getChampionName as getDefaultChampionName } from '../services/championService';
import type { SessionState } from '../types/session';

interface ServerUpdate {
  type: string;
  payload: any;
}

const FALLBACK_CHAMPION_ICON = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="%239ca3af"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" fill="%23ffffff">?</text></svg>';

export default defineComponent({
  name: 'SessionBoard',
  setup() {
    const name = ref('');
    const sessionId = ref('');
    const connected = ref(false);
    const connecting = ref(false);
    const statusMessage = ref('');
    const currentPlayerId = ref('');
    const selectedGoalId = ref('');
    const riotApiKey = ref('');
    const matchId = ref('');
    const verificationMessage = ref('');
    const championFilter = ref('');
    const showCompletedGoals = ref(false);
    const savedSessions = ref<Array<{ sessionId: string; playerCount: number; phase: string }>>([]);
    const serverPort = ref(4174);
    const serverPortLoaded = ref(false);
    const isProduction = ref(false);
    const championMap = reactive<Record<string, string>>({});
    const session = reactive<SessionState>({
      sessionId: '',
      phase: 'lobby',
      hostId: null,
      maxPlayers: 5,
      players: [],
      goals: [],
      unlockedChampionIds: [],
      lockedChampionIds: [],
      lastUpdated: Date.now()
    });

    onMounted(async () => {
      const champions = await fetchChampionList();
      champions.forEach((champion) => {
        championMap[champion.id] = champion.name;
      });
      await refreshServerPort();
      fetchSavedSessions();
    });

    async function refreshServerPort() {
      try {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        isProduction.value = !isLocalhost;

        if (isLocalhost) {
          const response = await fetch('/server-port.json');
          const data = await response.json();
          if (data?.port) {
            serverPort.value = data.port;
            serverPortLoaded.value = true;
          }
        } else {
          serverPortLoaded.value = true;
        }
      } catch (error) {
        console.warn('Unable to retrieve the backend server port.', error);
      }
    }

    function getServerUrl(): string {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `localhost:${serverPort.value}`;
      }
      return window.location.host;
    }

    function getWebSocketUrl(): string {
      const serverUrl = getServerUrl();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${serverUrl}`;
    }
    let ws: WebSocket | null = null;

    async function joinSession() {
      if (!name.value.trim()) {
        statusMessage.value = 'Please enter your name.';
        return;
      }
      if (!sessionId.value.trim()) {
        sessionId.value = generateSessionId();
      }

      statusMessage.value = '';
      connecting.value = true;
      if (!serverPortLoaded.value) {
        await refreshServerPort();
      }

      if (!serverPortLoaded.value) {
        connecting.value = false;
        statusMessage.value = 'Unable to determine the backend port. Make sure the server is running.';
        return;
      }

      try {
        const wsBaseUrl = getWebSocketUrl();
        const url = `${wsBaseUrl}/?sessionId=${encodeURIComponent(sessionId.value)}&name=${encodeURIComponent(name.value)}`;
        ws = new WebSocket(url);

        ws.addEventListener('open', () => {
          connected.value = true;
          connecting.value = false;
          statusMessage.value = 'Connected to the session server.';
        });

        ws.addEventListener('error', () => {
          connecting.value = false;
          const wsBaseUrl = getWebSocketUrl();
          statusMessage.value = `Unable to connect to ${wsBaseUrl}`;
        });

        ws.addEventListener('message', (event) => {
          const message: ServerUpdate = JSON.parse(event.data);
          if (message.type === 'joined') {
            currentPlayerId.value = message.payload.playerId;
            Object.assign(session, message.payload.state);
          }
          if (message.type === 'sessionUpdate') {
            Object.assign(session, message.payload);
          }
          if (message.type === 'verifyResult') {
            verificationMessage.value = message.payload.message;
          }
          if (message.type === 'error') {
            statusMessage.value = message.payload;
          }
        });

        ws.addEventListener('close', () => {
          connected.value = false;
          connecting.value = false;
          statusMessage.value = 'Disconnected from the session server.';
        });
      } catch (error) {
        connecting.value = false;
        statusMessage.value = 'Unable to connect to the session server.';
      }
    }

    async function fetchSavedSessions() {
      if (!serverPortLoaded.value) {
        await refreshServerPort();
      }

      try {
        const serverUrl = getServerUrl();
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const response = await fetch(`${protocol}//${serverUrl}/sessions`);
        const data = await response.json();
        savedSessions.value = Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('Unable to fetch saved sessions', error);
      }
    }

    function loadSavedSession(id: string) {
      sessionId.value = id;
    }

    function sendAction(type: string, payload: any) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        statusMessage.value = 'Session connection is not ready.';
        return;
      }
      ws.send(JSON.stringify({ type, payload }));
    }

    function completeGoal(goalId: string) {
      sendAction('completeGoal', { goalId });
    }

    function prepareVerification(goalId: string) {
      selectedGoalId.value = goalId;
      verificationMessage.value = '';
    }

    function verifySelectedGoal() {
      if (!selectedGoalId.value) {
        verificationMessage.value = 'Select a goal to verify.';
        return;
      }
      if (!matchId.value.trim()) {
        verificationMessage.value = 'Enter the match ID for verification.';
        return;
      }
      if (!riotApiKey.value.trim()) {
        verificationMessage.value = 'Enter your Riot API key.';
        return;
      }

      sendAction('verifyMatch', {
        goalId: selectedGoalId.value,
        matchId: matchId.value.trim(),
        apiKey: riotApiKey.value.trim()
      });
    }

    function cancelVerification() {
      selectedGoalId.value = '';
      verificationMessage.value = '';
    }

    function startSession() {
      sendAction('startSession', {});
    }

    function generateSessionId(): string {
      return `aram-${Math.random().toString(36).substring(2, 8)}`;
    }

    function getPlayerName(playerId: string | null): string {
      if (!playerId) return 'Unknown';
      const player = session.players.find((item) => item.id === playerId);
      return player ? player.name : 'Unknown';
    }

    function getChampionName(championId: string): string {
      return championMap[championId] ?? getDefaultChampionName(championId);
    }

    function getChampionImageUrlSafe(championId: string): string {
      return getChampionImageUrl(championId);
    }

    function onChampionImageError(event: Event) {
      const img = event.target as HTMLImageElement;
      if (!img) return;
      if (img.src === FALLBACK_CHAMPION_ICON) return;
      img.src = FALLBACK_CHAMPION_ICON;
    }

    function sortChampionIds(ids: string[]) {
      return ids.slice().sort((a, b) => getChampionName(a).localeCompare(getChampionName(b)));
    }

    function isCurrentPlayer(playerId: string): boolean {
      return playerId === currentPlayerId.value;
    }

    function getSessionChampionPoolIds() {
      const pool = new Set<string>();
      session.players.forEach((player) => {
        player.unlockedChampionIds.forEach((championId) => pool.add(championId));
      });
      return Array.from(pool);
    }

    function sortGoalsByChampion(goals: Array<any>) {
      return goals.slice().sort((a, b) => getChampionName(a.championId).localeCompare(getChampionName(b.championId)));
    }

    const openGoals = computed(() => sortGoalsByChampion(session.goals.filter((goal) => !goal.completed)));
    const completedGoals = computed(() => sortGoalsByChampion(session.goals.filter((goal) => goal.completed)));

    const selectedChampionFilter = ref<string[]>([]);

    function toggleChampionFilter(championId: string) {
      const idx = selectedChampionFilter.value.indexOf(championId);
      if (idx >= 0) {
        selectedChampionFilter.value.splice(idx, 1);
      } else {
        selectedChampionFilter.value.push(championId);
      }
    }

    function clearChampionFilter() {
      selectedChampionFilter.value = [];
    }

    const currentPlayerOpenGoals = computed(() => {
      let goals = session.goals.filter((goal) => !goal.completed && goal.playerId === currentPlayerId.value);
      if (selectedChampionFilter.value.length > 0) {
        goals = goals.filter((goal) => selectedChampionFilter.value.includes(goal.championId));
      }
      return sortGoalsByChampion(goals);
    });

    const currentPlayerCompletedGoals = computed(() => {
      let goals = session.goals.filter((goal) => goal.completed && goal.playerId === currentPlayerId.value);
      if (selectedChampionFilter.value.length > 0) {
        goals = goals.filter((goal) => selectedChampionFilter.value.includes(goal.championId));
      }
      return sortGoalsByChampion(goals);
    });

    const unlockedChampionEntries = computed(() => {
      const query = championFilter.value.trim().toLowerCase();
      const ownerMap = new Map<string, string[]>();

      session.players.forEach((player) => {
        player.unlockedChampionIds.forEach((championId) => {
          const owners = ownerMap.get(championId) ?? [];
          if (!owners.includes(player.name)) {
            owners.push(player.name);
          }
          ownerMap.set(championId, owners);
        });
      });

      return sortChampionIds(getSessionChampionPoolIds())
        .filter((id) => getChampionName(id).toLowerCase().includes(query))
        .map((championId) => ({
          championId,
          owners: ownerMap.get(championId) ?? []
        }));
    });

    const formattedLastUpdated = computed(() => {
      return new Date(session.lastUpdated).toLocaleTimeString();
    });

    const isHost = computed(() => session.hostId === currentPlayerId.value);

    function formatTime(timestamp: number): string {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const activityLog = computed(() =>
      session.goals
        .filter((goal) => goal.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        .map((goal) => ({
          goalId: goal.id,
          playerName: getPlayerName(goal.playerId),
          description: goal.description,
          time: goal.completedAt ? formatTime(goal.completedAt) : '',
          unlockChampionName: goal.unlockChampionId ? getChampionName(goal.unlockChampionId) : null,
          unlockForPlayerName: goal.unlockForPlayerId ? getPlayerName(goal.unlockForPlayerId) : null,
        }))
    );

    return {
      name,
      sessionId,
      connected,
      connecting,
      statusMessage,
      session,
      currentPlayerId,
      selectedGoalId,
      riotApiKey,
      matchId,
      verificationMessage,
      championFilter,
      unlockedChampionEntries,
      savedSessions,
      isProduction,
      joinSession,
      fetchSavedSessions,
      loadSavedSession,
      completeGoal,
      prepareVerification,
      verifySelectedGoal,
      cancelVerification,
      startSession,
      getPlayerName,
      getChampionName,
      getChampionImageUrlSafe,
      onChampionImageError,
      sortChampionIds,
      generateSessionId,
      isCurrentPlayer,
      formattedLastUpdated,
      isHost,
      openGoals,
      completedGoals,
      currentPlayerOpenGoals,
      currentPlayerCompletedGoals,
      showCompletedGoals,
      serverPort,
      activityLog,
      selectedChampionFilter,
      toggleChampionFilter,
      clearChampionFilter
    };
  }
});
</script>

<style scoped>
.session-shell {
  width: 100%;
  max-width: 1900px;
  margin: 0 auto;
  padding: 1rem 0;
  font-family: Inter, system-ui, sans-serif;
}

.hero-panel {
  text-align: center;
  margin-bottom: 2rem;
}

.hero-panel h1 {
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  margin-bottom: 0.5rem;
}

.join-panel,
.live-panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

input[type='text'] {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.session-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.primary-button {
  border: none;
  border-radius: 0.85rem;
  background: #2563eb;
  color: #ffffff;
  padding: 0.95rem 1.2rem;
  font-weight: 700;
  cursor: pointer;
}

.secondary-button {
  border: 1px solid #cbd5e1;
  border-radius: 0.85rem;
  background: #ffffff;
  color: #1f2937;
  padding: 0.9rem 1.2rem;
  font-weight: 700;
  cursor: pointer;
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.hint,
.note {
  color: #6b7280;
  margin-top: 1rem;
}

.error-message {
  color: #b91c1c;
  margin-top: 1rem;
}

.status-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1.6fr 2.2fr 1.2fr;
  grid-template-rows: minmax(600px, 1fr);
  gap: 1.75rem;
  align-items: stretch;
  max-height: calc(100vh - 400px);
}

.activity-log {
  background: #f8fafc;
  border-radius: 1rem;
  padding: 1rem;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.activity-log h2 {
  margin: 0 0 1.25rem 0;
}

.activity-list {
  list-style: none;
  padding: 0;
  padding-right: 0.75rem;
  margin: 0 -0.75rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1;
}

.activity-list::-webkit-scrollbar {
  width: 8px;
}

.activity-list::-webkit-scrollbar-track {
  background: #e5e7eb;
  border-radius: 10px;
}

.activity-list::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 10px;
}

.activity-list::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

.activity-entry {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.85rem;
  padding: 0.85rem;
  flex-shrink: 0;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.activity-player {
  font-weight: 700;
  color: #111827;
  font-size: 0.9rem;
}

.activity-time {
  color: #9ca3af;
  font-size: 0.8rem;
  white-space: nowrap;
}

.activity-desc {
  margin: 0;
  color: #374151;
  font-size: 0.875rem;
}

.activity-unlock {
  margin-top: 0.5rem;
  color: #0f766e;
  font-weight: 600;
  font-size: 0.85rem;
}

.activity-empty {
  border: 1px dashed #cbd5e1;
  border-radius: 0.85rem;
  padding: 1rem;
  color: #6b7280;
  text-align: center;
  flex-shrink: 0;
}

.lobby-layout {
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(320px, 560px);
  gap: 1.75rem;
}

.lobby-actions {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1rem;
}

.goal-actions {
  display: grid;
  gap: 0.75rem;
}

.verification-panel {
  margin-top: 1.25rem;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.9rem;
  background: #ffffff;
}

.verification-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-top: 0.75rem;
}

.goals-panel {
  background: #f8fafc;
  border-radius: 1rem;
  padding: 1rem;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.goals-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.75rem;
  margin-right: -0.75rem;
}

.goals-content ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
}

.goals-content::-webkit-scrollbar {
  width: 8px;
}

.goals-content::-webkit-scrollbar-track {
  background: #e5e7eb;
  border-radius: 10px;
}

.goals-content::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 10px;
}

.goals-content::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

.players-panel {
  background: #f8fafc;
  border-radius: 1rem;
  padding: 1rem;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.players-panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.5rem;
}

.players-panel ul::-webkit-scrollbar {
  width: 8px;
}

.players-panel ul::-webkit-scrollbar-track {
  background: #e5e7eb;
  border-radius: 10px;
}

.players-panel ul::-webkit-scrollbar-thumb {
  background: #9ca3af;
  border-radius: 10px;
}

.players-panel ul::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}

.players-panel li,
.goals-panel li {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.85rem;
  padding: 1rem;
}

.players-panel li.current {
  border-color: #2563eb;
}

.player-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.player-data {
  display: grid;
  gap: 0.5rem;
}

.player-data .label {
  color: #6b7280;
  font-size: 0.9rem;
}

.goal-line {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  min-width: 0;
}

.goal-line > div:first-child {
  min-width: 0;
}

.goal-section {
  margin-bottom: 1.25rem;
}

.goal-section h3 {
  margin-bottom: 1rem;
  font-size: 1rem;
  color: #111827;
}

.goal-empty {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 0.85rem;
  padding: 1rem;
  color: #6b7280;
}

.goal-meta {
  color: #4b5563;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.goal-reward {
  color: #0f766e;
  font-weight: 600;
  margin-top: 0.75rem;
}

.goals-panel li.completed {
  opacity: 0.75;
}

.goals-panel li {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.goals-panel li:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
}

.goals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  gap: 1.5rem;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.6rem;
  padding: 0.4rem 0.75rem;
  margin-bottom: 0.75rem;
}

.filter-bar-label {
  font-size: 0.875rem;
  color: #1d4ed8;
  font-weight: 500;
}

.filter-clear-button {
  border: none;
  background: none;
  color: #2563eb;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  padding: 0;
}

.filter-clear-button:hover {
  text-decoration: underline;
}

.goals-header h2 {
  margin: 0;
}

.goals-tabs {
  display: flex;
  gap: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.75rem;
  padding: 0.25rem;
}

.tab-button {
  border: none;
  background: transparent;
  color: #6b7280;
  padding: 0.65rem 1rem;
  border-radius: 0.6rem;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-button.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.goals-content {
  margin-bottom: 0;
}

.saved-sessions-panel {
  margin-top: 1.5rem;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 1rem;
  padding: 1rem;
}

.saved-sessions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .session-row-list {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .session-link {
    border: none;
    background: none;
    color: #2563eb;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
  }

  .session-meta {
    color: #6b7280;
    font-size: 0.95rem;
  }

  .champion-pool-panel {
    margin-top: 1.5rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1rem;
  }

  .champion-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .champion-pool-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .champion-list li {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .champion-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .champion-owners {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .champion-tags {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.4rem;
    margin-top: 0.5rem;
  }

  .champion-tags .champion-tag {
    padding: 0.35rem 0.6rem;
    font-size: 0.85rem;
    gap: 0.35rem;
  }

  .champion-tag-clickable {
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .champion-tag-clickable:hover {
    border-color: #2563eb;
  }

  .champion-tag-selected {
    background: #eff6ff;
    border-color: #2563eb;
    color: #1d4ed8;
  }

  .champion-tags .champion-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .champion-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    padding: 0.45rem 0.75rem;
    font-size: 0.95rem;
    color: #111827;
  }

  .champion-icon {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    object-fit: cover;
    background: #ffffff;
    border: 1px solid #e5e7eb;
  }

</style>