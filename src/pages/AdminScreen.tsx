import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { CitySelect } from '@/components/CitySelect';
import { getDefaultLearningAgents, type LearningAgent, type LearningAgentState, type ZoneHistory } from '@/lib/aiAgents';
import { useCities, useZones, useAddCity, useBulkInsertTimeSlots } from '@/hooks/useSupabase';
import { generateAISimulatedSlots } from '@/lib/aiSimulation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Zap, Database, Brain, Plus, Loader2, Car, TrendingUp, TrendingDown, Minus, Sparkles, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { ModeTaxi } from '@/components/ModeTaxi';
import { TripLogger } from '@/components/TripLogger';
import { UniversalFileAnalyzer } from '@/components/UniversalFileAnalyzer';
import { CsvImporter } from '@/components/CsvImporter';
import { WeeklyGoalSetting } from '@/components/WeeklyGoal';
import { DailyReports } from '@/components/DailyReports';
import { ExperimentalShiftComparison } from '@/components/ExperimentalShiftComparison';
import { searchOpenFoodFacts, type OpenFoodProduct } from '@/integrations/openFoodFacts';
import { searchFoursquarePlaces, type FoursquarePlace } from '@/integrations/foursquare';

interface AIRecommendation {
  zone_id: string;
  zone_name: string;
  new_score: number;
  peak_hours: string;
  best_days: string;
  trend: 'up' | 'down' | 'stable';
  tip: string;
}

export default function AdminScreen() {
  const { t } = useI18n();
  const { data: cities = [] } = useCities();
  const addCity = useAddCity();
  const [newCity, setNewCity] = useState('');
  const [simCityId, setSimCityId] = useState('mtl');
  const [simDate, setSimDate] = useState(() => new Date().toISOString().split('T')[0]);
  const { data: zones = [] } = useZones(simCityId);
  const bulkInsert = useBulkInsertTimeSlots();

  const [simProgress, setSimProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AIRecommendation[] | null>(null);
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null);

  const agents = useMemo<LearningAgent[]>(() => getDefaultLearningAgents(), []);
  const [agentStates, setAgentStates] = useState<Record<string, LearningAgentState>>(() => {
    try { return JSON.parse(localStorage.getItem('agentStates') ?? '{}'); } catch { return {}; }
  });
  const [learningHistory, setLearningHistory] = useState<ZoneHistory[]>([]);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [driftMetrics, setDriftMetrics] = useState({ meanError: 0, sample: 0 });

  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<OpenFoodProduct[]>([]);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<FoursquarePlace[]>([]);
  const [placeLocation, setPlaceLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch last AI analysis date + recent trips for drift / learning state
  useEffect(() => {
    supabase
      .from('score_history')
      .select('created_at')
      .like('reason', 'AI analysis%')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setLastAnalyzed(data[0].created_at);
      });

    supabase
      .from('trips')
      .select('*, zones(name, type, current_score)')
      .order('started_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          setRecentTrips(data);
        }
      });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPlaceLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('Geolocation permission denied:', err.message);
          toast.error(t('locationPermissionTip'));
        }
      );
    }
  }, [t]);

  async function handleAddCity() {
    if (!newCity.trim()) return;
    const id = newCity.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
    try {
      await addCity.mutateAsync({ id, name: newCity.trim() });
      setNewCity('');
      toast.success(t('addCity'));
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSimulate() {
    if (zones.length === 0) {
      toast.error(t('noZonesCity'));
      return;
    }
    setSimProgress({ current: 0, total: 1, label: simCityId });
    const slots = generateAISimulatedSlots(simCityId, simDate, zones);
    try {
      await bulkInsert.mutateAsync(slots);
      setSimProgress({ current: 1, total: 1, label: simCityId });
      toast.success(`${t('simulated')}: ${slots.length} slots (${zones.length} zones × 96 créneaux)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTimeout(() => setSimProgress(null), 1500);
    }
  }

  async function handleSimulateAll() {
    setSimProgress({ current: 0, total: cities.length, label: '' });
    try {
      let totalSlots = 0;
      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        setSimProgress({ current: i, total: cities.length, label: city.name });
        const { data: cityZones, error } = await supabase.from('zones').select('*').eq('city_id', city.id);
        if (error) throw error;
        if (!cityZones || cityZones.length === 0) continue;
        const slots = generateAISimulatedSlots(city.id, simDate, cityZones);
        await bulkInsert.mutateAsync(slots);
        totalSlots += slots.length;
      }
      setSimProgress({ current: cities.length, total: cities.length, label: 'Terminé' });
      toast.success(`${t('simulated')}: ${totalSlots} slots (${cities.length} villes)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTimeout(() => setSimProgress(null), 1500);
    }
  }

  async function handleSearchFood() {
    if (!foodQuery.trim()) return;
    try {
      const items = await searchOpenFoodFacts(foodQuery.trim());
      setFoodResults(items);
      toast.success(`${items.length} ${t('productsFound')}`);
    } catch (e: any) {
      toast.error(e.message || `${t('searchFailed')} (OpenFoodFacts)`);
    }
  }

  async function handleSearchPlaces() {
    if (!placeQuery.trim() || !placeLocation) {
      toast.error(t('locationOrQueryMissing'));
      return;
    }
    try {
      const places = await searchFoursquarePlaces(placeQuery.trim(), placeLocation.lat, placeLocation.lng);
      setPlaceResults(places);
      toast.success(`${places.length} ${t('placesFound')}`);
    } catch (e: any) {
      toast.error(e.message || 'Foursquare search failed');
    }
  }

  async function handleAIAnalysis() {
    setAiLoading(true);
    setAiResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-score-analysis');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiResults(data.recommendations || []);
      setLastAnalyzed(new Date().toISOString());
      toast.success(`${t('aiAnalysisDone')} — ${data.recommendations?.length || 0} ${t('aiRecommendations')}`);
    } catch (e: any) {
      toast.error(e.message || t('aiAnalysisError'));
    } finally {
      setAiLoading(false);
    }
  }

  const isSimulating = simProgress !== null;
  const progressPct = simProgress ? Math.round((simProgress.current / Math.max(simProgress.total, 1)) * 100) : 0;

  useEffect(() => {
    if (!recentTrips || recentTrips.length === 0) return;

    const history: ZoneHistory[] = recentTrips
      .map((trip) => {
        const zone = trip.zones || zones.find(z => z.id === trip.zone_id);
        if (!zone) return null;
        const expected = Number(zone.current_score || 50);
        const observed = Math.min(100, Math.max(0, Math.round((Number(trip.earnings || 0) + Number(trip.tips || 0)) / 0.75)));
        return {
          zoneId: zone.id,
          expectedScore: expected,
          observedScore: observed,
          timestamp: trip.started_at,
        };
      })
      .filter((item): item is ZoneHistory => item !== null);

    setLearningHistory(history);

    if (history.length > 0) {
      const errors = history.map((x) => Math.abs(x.observedScore - x.expectedScore));
      const meanError = errors.reduce((sum, v) => sum + v, 0) / errors.length;
      setDriftMetrics({ meanError: Number(meanError.toFixed(1)), sample: history.length });
    } else {
      setDriftMetrics({ meanError: 0, sample: 0 });
    }
  }, [recentTrips, zones]);

  function handleRetrainAgents() {
    const nextStates: Record<string, LearningAgentState> = {};
    for (const agent of agents) {
      nextStates[agent.id] = agent.learn(learningHistory);
    }
    setAgentStates(nextStates);
    localStorage.setItem('agentStates', JSON.stringify(nextStates));
    toast.success(t('agentLearned'));
  }

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col h-full pb-36 overflow-y-auto">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-display font-bold">{t('admin')}</h1>
      </div>

      <div className="px-4 space-y-4">
        {/* Mode Taxi */}
        <div className="space-y-1">
          <h2 className="text-[18px] font-display font-bold flex items-center gap-2 px-1">
            <Car className="w-5 h-5 text-primary" /> {t('adminModeTaxi')}
          </h2>
          <ModeTaxi />
        </div>

        {/* Weekly Goal Setting */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <WeeklyGoalSetting />
          </CardContent>
        </Card>

        {/* Trip Logger */}
        <TripLogger />

        {/* Daily Reports */}
        <DailyReports />

        {/* Experimental Shift Comparison */}
        <ExperimentalShiftComparison />

        {/* Universal File Analyzer */}
        <UniversalFileAnalyzer />

        {/* CSV Importer */}
        <CsvImporter />

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> {t('manageCities')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cities.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 border border-border">
                <span className="text-sm font-body">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.id}</span>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder={t('name')} value={newCity} onChange={e => setNewCity(e.target.value)} className="bg-background border-border" onKeyDown={e => e.key === 'Enter' && handleAddCity()} />
              <Button size="sm" onClick={handleAddCity} className="gap-1" disabled={addCity.isPending}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Zap className="w-4 h-4 text-demand-medium" /> {t('simulate')}
            </CardTitle>
            <CardDescription className="text-xs">{t('simulateDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <CitySelect cities={cities} value={simCityId} onChange={setSimCityId} />
              <Input type="date" value={simDate} onChange={e => setSimDate(e.target.value)} className="bg-background border-border" />
            </div>

            {isSimulating && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-body">
                  <span>{t('generationInProgress')} {simProgress.label}</span>
                  <span>{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
            )}

            <Button onClick={handleSimulate} className="w-full gap-2" disabled={isSimulating}>
              {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {t('simulate')} (1 ville)
            </Button>
            <Button onClick={handleSimulateAll} variant="secondary" className="w-full gap-2" disabled={isSimulating}>
              {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {t('simulate')} — Toutes les villes
            </Button>

            <div className="text-xs text-muted-foreground font-body space-y-0.5 pt-1 border-t border-border">
              <p className="font-medium text-foreground">{t('simulationMode')}</p>
              <p>{t('simulationExplanation')}</p>
              <p>{t('slotsCount')} {zones.length || '?'} zones = {zones.length ? zones.length * 96 : '?'} scores</p>
            </div>
          </CardContent>
        </Card>

        {/* AI Analysis Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> Analyse IA — Demand Scoring
            </CardTitle>
            <CardDescription className="text-xs">
              Analyse les 30 derniers jours de données et recalcule les scores par zone. Planifié automatiquement chaque dimanche à 23h.
            </CardDescription>
            {lastAnalyzed && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Clock className="w-3.5 h-3.5" />
                {t('aiLastAnalyzed')}: {new Date(lastAnalyzed).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleAIAnalysis} className="w-full gap-2" disabled={aiLoading}>
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiLoading ? t('aiRunning') : t('aiRunButton')}
            </Button>

            {aiResults && aiResults.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-xs font-medium text-foreground">{aiResults.length} zones analysées</p>
                {aiResults.map((rec) => (
                  <div key={rec.zone_id} className="bg-background rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-display font-semibold">{rec.zone_name}</span>
                      <div className="flex items-center gap-1.5">
                        <TrendIcon trend={rec.trend} />
                        <Badge variant={rec.new_score >= 70 ? 'default' : rec.new_score >= 40 ? 'secondary' : 'outline'} className="text-xs">
                          {rec.new_score}/100
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span>🕐 {rec.peak_hours}</span>
                      <span>📅 {rec.best_days}</span>
                    </div>
                    {rec.tip && (
                      <p className="text-xs text-muted-foreground italic">💡 {rec.tip}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {aiResults && aiResults.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Aucune recommandation générée. Ajoutez plus de données.</p>
            )}
          </CardContent>
        </Card>

        {/* Learning Agents Management Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> {t('agentsDashboard')}
            </CardTitle>
            <CardDescription className="text-xs">
              Les agents apprennent à partir des données de triplogs et ajustent les scores automatiquement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              <p>{t('agentLearned')} : {driftMetrics.sample} ({t('agentStatus')}: {driftMetrics.meanError}%)</p>
              <p>{t('agentStatus')}: {driftMetrics.meanError <= 10 ? 'OK' : 'Drift élevé'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-muted-foreground">
                    <th>{t('name')}</th>
                    <th>{t('agentStatus')}</th>
                    <th>{t('agentLastUpdated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} className="border-t border-border">
                      <td>{agent.name}</td>
                      <td>{agentStates[agent.id]?.lastUpdated ? t('agentLearned') : t('agentNotAvailable')}</td>
                      <td>{agentStates[agent.id]?.lastUpdated ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRetrainAgents} className="w-full" size="sm">
                {t('retrainAgents')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* External Data Search Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Zap className="w-4 h-4 text-demand-medium" /> {t('apiConnector')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('openFoodFactsDescription')} / {t('foursquareDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('openFoodFacts')} ({t('searchProducts')})</p>
              <div className="flex gap-2">
                <Input placeholder={t('searchProducts')} value={foodQuery} onChange={e => setFoodQuery(e.target.value)} className="bg-background border-border" />
                <Button onClick={handleSearchFood} variant="secondary" className="gap-2">
                  {t('searchProducts')}
                </Button>
              </div>
              {foodResults.length > 0 && (
                <div className="space-y-2 pt-2">
                  {foodResults.slice(0, 5).map(item => (
                    <div key={item.id || item.product_name} className="rounded-md border border-border bg-background p-2 text-xs">
                      <p className="font-semibold">{item.product_name || t('noData')}</p>
                      <p>{item.brands} • {item.quantity || '—'}</p>
                      <p>{t('nutritionGrade')} : {item.nutrition_grade_fr || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t('fourSquare')} ({t('searchPlaces')})</p>
              <div className="flex gap-2">
                <Input placeholder={t('searchPlaces')} value={placeQuery} onChange={e => setPlaceQuery(e.target.value)} className="bg-background border-border" />
                <Button onClick={handleSearchPlaces} variant="secondary" className="gap-2">
                  {t('searchPlaces')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{placeLocation ? `${t('currentLocation')}: ${placeLocation.lat.toFixed(4)} , ${placeLocation.lng.toFixed(4)}` : t('locationUnavailable')}</p>
              {placeResults.length > 0 && (
                <div className="space-y-2 pt-2">
                  {placeResults.slice(0, 5).map(place => (
                    <div key={place.fsq_id} className="rounded-md border border-border bg-background p-2 text-xs">
                      <p className="font-semibold">{place.name}</p>
                      <p>{place.location.address || place.location.locality || t('noData')}</p>
                      <p>{place.categories?.[0]?.name || t('noData')} • {place.distance ? `${place.distance} m` : '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
