import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { AtributoCor, LeituraMapa } from "../../types/leitura";
import { ClusterLayer } from "./ClusterLayer";
import { DistanceTool } from "./DistanceTool";
import { HeatmapLayer } from "./HeatmapLayer";
import { MapControls } from "./MapControls";

// Ícones padrão do Leaflet quebram no bundler sem essa correção.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const TILE_LAYERS = {
  padrao: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
};

const CENTRO_PADRAO: [number, number] = [-29.79, -55.8]; // Alegrete/RS, ajustado ao primeiro carregamento

interface MapViewProps {
  dados: LeituraMapa[];
  atributoCor: AtributoCor;
  buscaAtiva: boolean;
  onSelecionarLeitura: (id: number) => void;
}

function FitBoundsOnData({ dados }: { dados: LeituraMapa[] }) {
  const map = useMap();
  const ajustado = useRef(false);

  if (!ajustado.current && dados.length > 0) {
    const bounds = L.latLngBounds(dados.map((d) => [d.lat, d.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    ajustado.current = true;
  }
  return null;
}

function FlyToSearchResult({ dados, buscaAtiva }: { dados: LeituraMapa[]; buscaAtiva: boolean }) {
  const map = useMap();
  const ultimoId = useRef<number | null>(null);

  if (buscaAtiva && dados.length === 1 && dados[0].id !== ultimoId.current) {
    ultimoId.current = dados[0].id;
    map.flyTo([dados[0].lat, dados[0].lon], Math.max(map.getZoom(), 16));
  } else if (!buscaAtiva) {
    ultimoId.current = null;
  }
  return null;
}

export function MapView({ dados, atributoCor, buscaAtiva, onSelecionarLeitura }: MapViewProps) {
  const [camada, setCamada] = useState<keyof typeof TILE_LAYERS>("padrao");
  const [heatmapAtivo, setHeatmapAtivo] = useState(false);
  const [medindoDistancia, setMedindoDistancia] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const tile = useMemo(() => TILE_LAYERS[camada], [camada]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <MapContainer
        center={CENTRO_PADRAO}
        zoom={12}
        preferCanvas
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} />
        <FitBoundsOnData dados={dados} />
        <FlyToSearchResult dados={dados} buscaAtiva={buscaAtiva} />

        {heatmapAtivo ? (
          <HeatmapLayer pontos={dados} />
        ) : (
          <ClusterLayer
            dados={dados}
            atributoCor={atributoCor}
            onSelecionarLeitura={onSelecionarLeitura}
          />
        )}

        <DistanceTool ativo={medindoDistancia} />

        <MapControls
          camada={camada}
          onMudarCamada={setCamada}
          heatmapAtivo={heatmapAtivo}
          onToggleHeatmap={() => setHeatmapAtivo((v) => !v)}
          medindoDistancia={medindoDistancia}
          onToggleMedicao={() => setMedindoDistancia((v) => !v)}
          containerRef={containerRef}
        />
      </MapContainer>
    </div>
  );
}
