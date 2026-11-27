import type { CircleMarker, Map as LeafletMap, TileLayer } from 'leaflet';
import leafletCss from 'leaflet/dist/leaflet.css';
import { ctx, withContext } from './context';
import type { RuneApp } from './types';
import { escapeHtml } from './utils';

const osmTiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function mapTiles(element: HTMLElement): { url: string; attribution: string } {
  const url = element.dataset.mapTiles
    ? element.dataset.mapTiles.replace(/\$z/g, '{z}').replace(/\$x/g, '{x}').replace(/\$y/g, '{y}')
    : osmTiles;
  const attribution = element.dataset.mapAttribution;
  if (!['{z}', '{x}', '{y}'].every(part => url.includes(part))) {
    throw new Error('Map tile URL must contain {z}, {x}, and {y}.');
  }
  const parsed = new URL(url.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0'));
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Map tiles require an HTTPS URL without embedded credentials.');
  }
  if (url !== osmTiles && !attribution) throw new Error('A custom tile provider requires data-map-attribution.');
  return { url, attribution: url === osmTiles ? osmAttribution : escapeHtml(attribution!) };
}

type MapEntry = {
  element: HTMLElement;
  map: LeafletMap;
  marker: CircleMarker;
  tiles: TileLayer;
  tileUrl: string;
  attribution: string;
  latitude: number;
  longitude: number;
};

/** Preserve map DOM across Rune-Web's full-tree renders. */
export function createMapManager() {
  const entries = new Map<string, MapEntry>();
  const context = () => ctx();

  function detach(root: HTMLElement): Map<string, HTMLElement> {
    const saved = new Map<string, HTMLElement>();
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('[data-rune-map]'))) {
      const key = element.dataset.runeMap;
      if (key && entries.has(key)) {
        element.remove();
        saved.set(key, element);
      }
    }
    return saved;
  }

  function restore(root: HTMLElement, saved: Map<string, HTMLElement>, app: RuneApp): void {
    const found = new Set<string>();
    for (const placeholder of Array.from(root.querySelectorAll<HTMLElement>('[data-rune-map]'))) {
      const key = placeholder.dataset.runeMap;
      const latitude = Number(placeholder.dataset.latitude);
      const longitude = Number(placeholder.dataset.longitude);
      let tileConfig: ReturnType<typeof mapTiles>;
      try {
        tileConfig = mapTiles(placeholder);
      } catch (error) {
        console.error('Rune-Web map configuration error:', error);
        continue;
      }
      if (!key || found.has(key) || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        console.error('Rune-Web map requires a unique data-rune-map and valid coordinates.');
        continue;
      }
      found.add(key);
      const old = saved.get(key);
      const entry = entries.get(key);
      if (old && entry) {
        for (const attr of Array.from(placeholder.attributes)) {
          if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) old.setAttribute(attr.name, attr.value);
        }
        placeholder.replaceWith(old);
        if (tileConfig.url !== entry.tileUrl || tileConfig.attribution !== entry.attribution) {
          entry.map.attributionControl.removeAttribution(entry.attribution);
          entry.tiles.options.attribution = tileConfig.attribution;
          entry.map.attributionControl.addAttribution(tileConfig.attribution);
          entry.tiles.setUrl(tileConfig.url);
          entry.tileUrl = tileConfig.url;
          entry.attribution = tileConfig.attribution;
        }
        if (latitude !== entry.latitude || longitude !== entry.longitude) {
          entry.latitude = latitude;
          entry.longitude = longitude;
          entry.marker.setLatLng([latitude, longitude]);
          entry.map.setView([latitude, longitude], entry.map.getZoom(), { animate: false });
        }
        entry.map.invalidateSize({ animate: false });
        continue;
      }
      const captured = context();
      void import('leaflet').then(L => {
        if (!placeholder.isConnected || entries.has(key)) return;
        if (!document.getElementById('rune-leaflet-css')) {
          const style = document.createElement('style');
          style.id = 'rune-leaflet-css';
          style.textContent = leafletCss;
          document.head.append(style);
        }
        const map = L.map(placeholder, { zoomControl: true }).setView([latitude, longitude], 10);
        const tiles = L.tileLayer(tileConfig.url, {
          maxZoom: 19,
          attribution: tileConfig.attribution,
        }).addTo(map);
        const marker = L.circleMarker([latitude, longitude], { radius: 8, color: '#126a78', fillOpacity: 0.8 }).addTo(map);
        const select = (lat: number, lon: number) => withContext(captured, () => {
          const action = placeholder.dataset.mapSelect;
          if (!action) {
            console.error('Rune-Web map requires data-map-select.');
            return;
          }
          app.invokeAction(action, [{ latitude: Number(lat.toFixed(5)), longitude: Number(lon.toFixed(5)) }]);
          app.render();
        });
        map.on('click', event => {
          const point = event.latlng.wrap();
          select(point.lat, point.lng);
        });
        placeholder.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Enter' && event.target === placeholder) {
            event.preventDefault();
            const center = map.getCenter().wrap();
            select(center.lat, center.lng);
          }
        });
        entries.set(key, { element: placeholder, map, marker, tiles, tileUrl: tileConfig.url, attribution: tileConfig.attribution, latitude, longitude });
      }).catch(error => console.error('Rune-Web map could not initialize:', error));
    }
    for (const [key, entry] of entries) {
      if (!found.has(key)) {
        entry.map.remove();
        entries.delete(key);
      }
    }
  }

  return { detach, restore };
}
