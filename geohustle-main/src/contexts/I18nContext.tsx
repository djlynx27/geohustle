import React, { createContext, useContext, useState, useCallback } from 'react';

type Lang = 'en' | 'fr';

const translations: Record<string, Record<Lang, string>> = {
  today: { en: 'Today', fr: "Aujourd'hui" },
  planning: { en: 'Planning', fr: 'Planification' },
  zones: { en: 'Zones', fr: 'Zones' },
  admin: { en: 'Admin', fr: 'Admin' },
  selectCity: { en: 'Select city', fr: 'Sélectionner la ville' },
  bestZone: { en: 'Best Zone Now', fr: 'Meilleure zone maintenant' },
  nextSlots: { en: 'Next Recommended', fr: 'Prochaines recommandations' },
  demandHigh: { en: 'High Demand', fr: 'Forte demande' },
  demandMedium: { en: 'Medium Demand', fr: 'Demande moyenne' },
  demandLow: { en: 'Low Demand', fr: 'Faible demande' },
  score: { en: 'Score', fr: 'Score' },
  zone: { en: 'Zone', fr: 'Zone' },
  type: { en: 'Type', fr: 'Type' },
  schedule: { en: '24h Schedule', fr: 'Horaire 24h' },
  selectDate: { en: 'Select date', fr: 'Sélectionner la date' },
  allZones: { en: 'All Zones', fr: 'Toutes les zones' },
  addZone: { en: 'Add Zone', fr: 'Ajouter une zone' },
  editZone: { en: 'Edit Zone', fr: 'Modifier la zone' },
  deleteZone: { en: 'Delete', fr: 'Supprimer' },
  save: { en: 'Save', fr: 'Enregistrer' },
  cancel: { en: 'Cancel', fr: 'Annuler' },
  name: { en: 'Name', fr: 'Nom' },
  latitude: { en: 'Latitude', fr: 'Latitude' },
  longitude: { en: 'Longitude', fr: 'Longitude' },
  city: { en: 'City', fr: 'Ville' },
  manageCities: { en: 'Manage Cities', fr: 'Gérer les villes' },
  manageZones: { en: 'Manage Zones', fr: 'Gérer les zones' },
  simulate: { en: 'Simulate Demand', fr: 'Simuler la demande' },
  simulateDesc: { en: 'Generate demand scores for selected date', fr: 'Générer les scores de demande pour la date sélectionnée' },
  apiConnector: { en: 'AI Connector', fr: 'Connecteur IA' },
  apiDesc: { en: 'Future Abacus AI integration placeholder', fr: 'Espace réservé pour intégration Abacus AI' },
  noData: { en: 'No data for this slot', fr: 'Aucune donnée pour ce créneau' },
  currentSlot: { en: 'Current Slot', fr: 'Créneau actuel' },
  addCity: { en: 'Add City', fr: 'Ajouter une ville' },
  simulated: { en: 'Simulated', fr: 'Simulé' },
  edit: { en: 'Edit', fr: 'Modifier' },
  events: { en: 'Events', fr: 'Événements' },
};

interface I18nContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'fr',
  toggleLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('fr');
  const toggleLang = useCallback(() => setLang(l => l === 'en' ? 'fr' : 'en'), []);
  const t = useCallback((key: string) => translations[key]?.[lang] ?? key, [lang]);

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
