import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";

interface DistanceToolProps {
  ativo: boolean;
}

/**
 * Ferramenta simples de medição: em modo ativo, cada clique adiciona
 * um ponto; a distância acumulada é exibida em um tooltip fixo.
 */
export function DistanceTool({ ativo }: DistanceToolProps) {
  const map = useMap();
  const pontosRef = useRef<L.LatLng[]>([]);
  const linhaRef = useRef<L.Polyline | null>(null);
  const tooltipRef = useRef<L.Tooltip | null>(null);

  useEffect(() => {
    if (!ativo) {
      pontosRef.current = [];
      linhaRef.current?.remove();
      linhaRef.current = null;
      tooltipRef.current?.remove();
      tooltipRef.current = null;
      map.getContainer().style.cursor = "";
    } else {
      map.getContainer().style.cursor = "crosshair";
    }
  }, [ativo, map]);

  useMapEvents({
    click(e) {
      if (!ativo) return;

      pontosRef.current.push(e.latlng);

      if (!linhaRef.current) {
        linhaRef.current = L.polyline(pontosRef.current, {
          color: "#ffd43b",
          weight: 3,
          dashArray: "6 6",
        }).addTo(map);
      } else {
        linhaRef.current.setLatLngs(pontosRef.current);
      }

      let distanciaTotal = 0;
      for (let i = 1; i < pontosRef.current.length; i++) {
        distanciaTotal += pontosRef.current[i - 1].distanceTo(pontosRef.current[i]);
      }

      const label =
        distanciaTotal >= 1000
          ? `${(distanciaTotal / 1000).toFixed(2)} km`
          : `${distanciaTotal.toFixed(0)} m`;

      tooltipRef.current?.remove();
      tooltipRef.current = L.tooltip({ permanent: true, direction: "top" })
        .setLatLng(e.latlng)
        .setContent(`Distância total: ${label}`)
        .addTo(map);
    },
  });

  return null;
}
