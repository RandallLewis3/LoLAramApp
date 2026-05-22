export interface ChampionInfo {
  id: string;
  name: string;
}

const DEFAULT_CHAMPIONS: ChampionInfo[] = [
  { id: 'Ashe', name: 'Ashe' },
  { id: 'Darius', name: 'Darius' },
  { id: 'Evelynn', name: 'Evelynn' },
  { id: 'Garen', name: 'Garen' },
  { id: 'Jinx', name: 'Jinx' },
  { id: 'Leona', name: 'Leona' },
  { id: 'Lux', name: 'Lux' },
  { id: 'Maokai', name: 'Maokai' },
  { id: 'Sona', name: 'Sona' },
  { id: 'Yasuo', name: 'Yasuo' },
  { id: 'Annie', name: 'Annie' },
  { id: 'Braum', name: 'Braum' },
  { id: 'Caitlyn', name: 'Caitlyn' },
  { id: 'DrMundo', name: 'Dr. Mundo' },
  { id: 'Janna', name: 'Janna' },
  { id: 'Karma', name: 'Karma' },
  { id: 'Malphite', name: 'Malphite' },
  { id: 'Nami', name: 'Nami' },
  { id: 'Rammus', name: 'Rammus' },
  { id: 'Zed', name: 'Zed' }
];

const DD_VERSION = '14.24.1';
let currentDDragonVersion = DD_VERSION;

export function getDefaultChampions(): ChampionInfo[] {
  return DEFAULT_CHAMPIONS;
}

export function getChampionName(championId: string): string {
  const champion = DEFAULT_CHAMPIONS.find((item) => item.id === championId);
  return champion ? champion.name : championId;
}

export function getChampionImageUrl(championId: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${currentDDragonVersion}/img/champion/${championId}.png`;
}

export async function fetchChampionList(): Promise<ChampionInfo[]> {
  try {
    const versionResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!versionResponse.ok) throw new Error('Failed to fetch Data Dragon versions');
    const versions: string[] = await versionResponse.json();
    const latestVersion = versions[0] ?? DD_VERSION;
    currentDDragonVersion = latestVersion;
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
    if (!response.ok) throw new Error('Failed to fetch champion data');
    const payload = await response.json();
    return Object.values(payload.data).map((item: any) => ({ id: item.id, name: item.name }));
  } catch (error) {
    console.warn('Riot Data Dragon fetch failed, using default champion list.', error);
    return DEFAULT_CHAMPIONS;
  }
}
