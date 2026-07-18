import L from "leaflet";
import "leaflet.heat";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { LeituraMapa } from "../../types/leitura";

interface HeatmapLayerProps {
  pontos: LeituraMapa[];
}

export function HeatmapLayer({ pontos }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (pontos.length === 0) return;

    const heatPoints: [number, number, number][] = pontos.map((p) => [p.lat, p.lon, 0.6]);
    // @ts-expect-error - leaflet.heat estende L sem tipos oficiais
    const heatLayer = L.heatLayer(heatPoints, {
      radius: 22,
      blur: 18,
      maxZoom: 17,
      gradient: { 0.2: "#3ea6ff", 0.5: "#ffd43b", 0.8: "#ff6b6b" },
    });

    heatLayer.addTo(map);
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, pontos]);

  return null;
}
