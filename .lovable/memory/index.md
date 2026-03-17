Map and design decisions for ZonePilote/GeoHustle project

- Mapbox token hardcoded in src/components/MapboxHeatmap.tsx
- Map height: 260px on Today, 220px on Zones
- Dark mode only design (no light mode)
- Published at geo-hustle.lovable.app
- City selection persisted in localStorage via useCityId hook
- Event notifications deduped via localStorage (geohustle_notified_events)
- Venue drop-off coordinates in src/lib/venueCoordinates.ts
- Cities: mtl, lvl, lng, blv, rsm, sth, bsb, trb
- Driver icon: pink/magenta steering wheel on map
- Universal file analyzer replaces ScreenshotAnalyzer in Admin
