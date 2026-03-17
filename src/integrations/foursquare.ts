export interface FoursquarePlace {
  fsq_id: string;
  name: string;
  location: {
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
  };
  categories: { id: number; name: string; icon: { prefix: string; suffix: string } }[];
  distance?: number;
}

export async function searchFoursquarePlaces(query: string, latitude: number, longitude: number, limit = 12): Promise<FoursquarePlace[]> {
  const apiKey = import.meta.env.VITE_FOURSQUARE_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error('Foursquare API key is not configured (VITE_FOURSQUARE_API_KEY)');
  }

  const url = new URL('https://api.foursquare.com/v3/places/search');
  url.searchParams.set('query', query);
  url.searchParams.set('ll', `${latitude},${longitude}`);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Foursquare API error ${res.status}`);
  }

  const data = await res.json();
  return data.results ?? [];
}