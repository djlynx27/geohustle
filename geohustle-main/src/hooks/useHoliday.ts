import { useQuery } from '@tanstack/react-query';

interface Holiday {
  id: number;
  date: string;
  nameEn: string;
  nameFr: string;
}

interface HolidayResult {
  isHoliday: boolean;
  name: string | null;
}

export function useHoliday(date: string): { data: HolidayResult | undefined; isLoading: boolean } {
  return useQuery<HolidayResult>({
    queryKey: ['holiday', date],
    queryFn: async () => {
      const year = date.split('-')[0];
      const res = await fetch(`https://canada-holidays.ca/api/v1/holidays?province=QC&year=${year}`);
      if (!res.ok) return { isHoliday: false, name: null };
      const json = await res.json();
      const holidays: Holiday[] = json.holidays ?? [];
      const match = holidays.find((h) => h.date === date);
      return {
        isHoliday: !!match,
        name: match?.nameFr ?? match?.nameEn ?? null,
      };
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
}
