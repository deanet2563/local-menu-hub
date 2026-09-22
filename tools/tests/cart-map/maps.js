// SDK double keeps late callbacks alive deliberately. The host must still exist.
window.mapStats = { maps: [], markers: [], listeners: new Set(), detached: 0, lateChecks: 0, zeroSize: 0 };
window.installMaps = () => {
  const stats = window.mapStats;
  const later = (map) => setTimeout(() => {
    stats.lateChecks++;
    if (!map.element.isConnected) stats.detached++;
  }, 250);
  const listen = (target, event, handler) => {
    const entry = { target, event, handler };
    stats.listeners.add(entry);
    return { remove() { stats.listeners.delete(entry); } };
  };
  class Map {
    constructor(element) {
      this.element = element;
      element.dataset.testGoogleMap = 'true';
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) stats.zeroSize++;
      stats.maps.push(this);
      later(this);
    }
    setCenter(position) { this.center = position; }
    setZoom(zoom) { this.zoom = zoom; }
    getBounds() { return undefined; }
    fitBounds() { const box = this.element.getBoundingClientRect(); if (!box.width || !box.height) stats.zeroSize++; }
    addListener(event, handler) { return listen(this, event, handler); }
  }
  class Marker {
    constructor(options) { this.map = options.map; this.position = options.position; this.draggable = options.draggable; stats.markers.push(this); }
    setMap(map) { if (this.map) later(this.map); this.map = map; }
    setPosition(position) { this.position = position; }
    addListener(event, handler) { return listen(this, event, handler); }
  }
  class AdvancedMarkerElement extends Marker {
    set map(value) { if (this._map) later(this._map); this._map = value; }
    get map() { return this._map; }
  }
  window.google = { maps: { Map, Marker, marker: { AdvancedMarkerElement }, importLibrary: async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { AdvancedMarkerElement };
  } } };
  window.clickMap = () => {
    for (const listener of [...stats.listeners]) if (listener.event === 'click' && listener.target instanceof Map) listener.handler({ latLng: { lat: () => 13.78, lng: () => 100.68 } });
  };
};
