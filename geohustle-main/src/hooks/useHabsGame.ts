import { useQuery } from '@tanstack/react-query';

interface NHLGame {
  gameDate: string;
  startTimeUTC: string;
  homeTeam: { abbrev: string };
  awayTeam: { abbrev: string };
}

interface HabsGameResult {
  isHomeGame: boolean;
  isPostGame: boolean;
  gameTime: string | null;
  awayTeam: string | null;
}

export function useHabsGame(date: string): { data: HabsGameResult | undefined; isLoading: boolean } {
  return useQuery<HabsGameResult>({
    queryKey: ['habs-game', date],
    queryFn: async () => {
      try {
        const res = await fetch('https://api-web.nhle.com/v1/club-schedule-season/mtl/20242025');
        if (!res.ok) return { isHomeGame: false, isPostGame: false, gameTime: null, awayTeam: null };
        const json = await res.json();
        const games: NHLGame[] = json.games ?? [];
        const match = games.find(
          (g) => g.gameDate === date && g.homeTeam.abbrev === 'MTL'
        );
        if (!match) return { isHomeGame: false, isPostGame: false, gameTime: null, awayTeam: null };

        const now = new Date();
        const isPostGame = now.getHours() >= 22;

        return {
          isHomeGame: true,
          isPostGame,
          gameTime: new Date(match.startTimeUTC).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }),
          awayTeam: match.awayTeam.abbrev,
        };
      } catch {
        return { isHomeGame: false, isPostGame: false, gameTime: null, awayTeam: null };
      }
    },
    staleTime: 30 * 60 * 1000,
  });
}
