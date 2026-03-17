export interface OpenFoodProduct {
  id: string;
  product_name: string;
  brands: string;
  quantity: string;
  cities: string;
  labels: string;
  ingredients_text: string;
  nutrition_grade_fr: string;
  image_url: string;
}

export async function searchOpenFoodFacts(query: string, limit = 10): Promise<OpenFoodProduct[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(limit));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`OpenFoodFacts API error ${res.status}`);
  }

  const data = await res.json();
  if (!data.products) return [];

  return data.products.map((p: any) => ({
    id: p.id || p._id || '',
    product_name: p.product_name || p.generic_name || '',
    brands: p.brands || '',
    quantity: p.quantity || '',
    cities: p.cities || '',
    labels: p.labels || '',
    ingredients_text: p.ingredients_text || '',
    nutrition_grade_fr: p.nutrition_grade_fr || '',
    image_url: p.image_url || p.image_front_url || '',
  }));
}