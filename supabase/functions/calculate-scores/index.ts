import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  mtl: { lat: 45.5017, lng: -73.5673 },
  lvl: { lat: 45.5559, lng: -73.7217 },
  lng: { lat: 45.5249, lng: -73.5219 },
};

const TM_API_KEY = Deno.env.get("TM_API_KEY") ?? "";

// Known venue capacities
const VENUE_CAPACITIES: Record<string, number> = {
  "Centre Bell": 21000,
  "Bell Centre": 21000,
  "Place Bell": 10000,
  "Stade olympique": 56000,
  "Stade Olympique": 56000,
  "Olympic Stadium": 56000,
  "Théâtre St-Denis": 2500,
  MTELUS: 2300,
  "L'Olympia": 1200,
  "Club Soda": 500,
};

function capacityToBoost(capacity: number): number {
  if (capacity >= 40000) return 35;
  if (capacity >= 15000) return 30;
  if (capacity >= 5000) return 25;
  return 20;
}

// Haversine distance in km
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface WeatherData {
  precipProbability: number;
  weatherCode: number;
  demandBoostPoints: number;
}

async function fetchWeather(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=America/Toronto&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const currentHour = new Date().getHours();
    const precipProb = data?.hourly?.precipitation_probability?.[currentHour] ?? 0;
    const weatherCode = data?.current?.weather_code ?? 0;

    let boost = 0;
    // Snow (71-77)
    if (weatherCode >= 71 && weatherCode <= 77) boost = 30;
    else if (precipProb > 80) boost = 25;
    else if (precipProb > 60) boost = 15;

    return {
      precipProbability: precipProb,
      weatherCode,
      demandBoostPoints: boost,
    };
  } catch {
    return null;
  }
}

interface TmEvent {
  name: string;
  venueName: string;
  latitude: number;
  longitude: number;
  startDate: string;
  capacity: number;
  boostPoints: number;
}

async function fetchTicketmasterEvents(
  lat: number,
  lng: number
): Promise<TmEvent[]> {
  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&latlong=${lat},${lng}&radius=30&unit=km&size=50&sort=date,asc`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const embedded = data?._embedded?.events;
    if (!Array.isArray(embedded)) return [];

    return embedded
      .map((ev: any) => {
        const venue = ev._embedded?.venues?.[0];
        if (!venue?.location) return null;
        const venueName = venue.name ?? "";
        const vLat = parseFloat(venue.location.latitude);
        const vLng = parseFloat(venue.location.longitude);
        if (isNaN(vLat) || isNaN(vLng)) return null;

        const startDate =
          ev.dates?.start?.dateTime ?? ev.dates?.start?.localDate ?? "";
        const capacity = VENUE_CAPACITIES[venueName] ?? 2000;

        return {
          name: ev.name,
          venueName,
          latitude: vLat,
          longitude: vLng,
          startDate,
          capacity,
          boostPoints: capacityToBoost(capacity),
        };
      })
      .filter(Boolean) as TmEvent[];
  } catch {
    return [];
  }
}

// Base scores by zone type
const BASE_SCORES: Record<string, number> = {
  aéroport: 70,
  métro: 65,
  nightlife: 70,
  transport: 65,
  événements: 75,
  commercial: 60,
  université: 55,
  médical: 50,
  tourisme: 60,
  résidentiel: 40,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TM_API_KEY) {
      throw new Error("TM_API_KEY is not configured");
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all zones
    const { data: zones, error: zonesErr } = await supabase
      .from("zones")
      .select("*");
    if (zonesErr) throw zonesErr;

    const now = new Date();
    const nowMs = now.getTime();
    const threeHoursMs = 3 * 60 * 60 * 1000;
    const eventDuration = 3 * 60 * 60 * 1000;

    // Fetch weather for each city
    const weatherByCity: Record<string, WeatherData | null> = {};
    for (const [cityId, coords] of Object.entries(CITY_COORDS)) {
      weatherByCity[cityId] = await fetchWeather(coords.lat, coords.lng);
    }

    // Fetch Ticketmaster events for MTL (main market)
    const tmEvents = await fetchTicketmasterEvents(45.5017, -73.5673);

    // Filter relevant TM events (active or starting within 3h)
    const relevantTmEvents = tmEvents.filter((ev) => {
      const start = new Date(ev.startDate).getTime();
      if (isNaN(start)) return false;
      const end = start + eventDuration;
      return (
        (start - nowMs <= threeHoursMs && start - nowMs >= 0) ||
        (nowMs >= start && nowMs <= end)
      );
    });

    // Save TM events to events table (upsert by name+venue+date)
    for (const ev of relevantTmEvents) {
      const startAt = new Date(ev.startDate).toISOString();
      const endAt = new Date(
        new Date(ev.startDate).getTime() + eventDuration
      ).toISOString();

      // Check if event already exists
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("name", ev.name)
        .eq("venue", ev.venueName)
        .gte("start_at", startAt.split("T")[0])
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("events").insert({
          name: ev.name,
          venue: ev.venueName,
          latitude: ev.latitude,
          longitude: ev.longitude,
          start_at: startAt,
          end_at: endAt,
          capacity: ev.capacity,
          demand_impact: Math.round(ev.boostPoints / 7),
          boost_multiplier: 1 + ev.boostPoints / 50,
          boost_radius_km: 2,
          category: "event",
          source: "ticketmaster",
          expected_attendance: ev.capacity,
        });
      }
    }

    // Calculate scores for each zone
    const scoreRows: any[] = [];
    const historyRows: any[] = [];
    const zoneUpdates: { id: string; current_score: number }[] = [];

    for (const zone of zones!) {
      const weather = weatherByCity[zone.city_id] ?? null;
      const baseScore = zone.base_score ?? BASE_SCORES[zone.type] ?? 50;

      // Weather boost
      const weatherBoost = weather?.demandBoostPoints ?? 0;

      // Event boost (proximity-based)
      let eventBoost = 0;
      for (const ev of relevantTmEvents) {
        const dist = haversineKm(
          zone.latitude,
          zone.longitude,
          ev.latitude,
          ev.longitude
        );
        if (dist <= 3) {
          eventBoost = Math.max(eventBoost, ev.boostPoints);
        }
      }

      // Weighted: 50% base + 25% weather + 25% events
      const finalScore = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            baseScore * 0.5 +
              (baseScore + weatherBoost) * 0.25 +
              (baseScore + eventBoost) * 0.25
          )
        )
      );

      scoreRows.push({
        zone_id: zone.id,
        score: baseScore,
        weather_boost: weatherBoost,
        event_boost: eventBoost,
        final_score: finalScore,
        calculated_at: now.toISOString(),
      });

      // Build reason string
      const reasons: string[] = [];
      if (weatherBoost > 0)
        reasons.push(`weather:+${weatherBoost}`);
      if (eventBoost > 0) reasons.push(`event:+${eventBoost}`);

      historyRows.push({
        zone_id: zone.id,
        score: finalScore,
        reason: reasons.join(", ") || "base",
      });

      zoneUpdates.push({ id: zone.id, current_score: finalScore });
    }

    // Batch insert scores
    if (scoreRows.length > 0) {
      await supabase.from("scores").insert(scoreRows);
    }

    // Batch insert history
    if (historyRows.length > 0) {
      await supabase.from("score_history").insert(historyRows);
    }

    // Update current_score on zones
    for (const upd of zoneUpdates) {
      await supabase
        .from("zones")
        .update({ current_score: upd.current_score })
        .eq("id", upd.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        zonesUpdated: zoneUpdates.length,
        tmEventsFound: relevantTmEvents.length,
        weather: Object.fromEntries(
          Object.entries(weatherByCity).map(([k, v]) => [
            k,
            v?.demandBoostPoints ?? 0,
          ])
        ),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("calculate-scores error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
