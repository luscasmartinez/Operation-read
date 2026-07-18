import { memo, useEffect, useRef, useState } from "react";
import { CircleMarker, Popup } from "react-leaflet";
import type { AtributoCor, LeituraMapa } from "../../types/leitura";
import { corParaCategoria } from "../../utils/colorHash";
import { MarkerPopup } from "./MarkerPopup";
import { ProgressBar } from "./ProgressBar";

const TAMANHO_LOTE = 3_000;

interface ClusterLayerProps {
  dados: LeituraMapa[];
  atributoCor: AtributoCor;
  onSelecionarLeitura: (id: number) => void;
}

function ClusterLayerImpl({ dados, atributoCor, onSelecionarLeitura }: ClusterLayerProps) {
  const [lote, setLote] = useState(1);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setLote(1);
    return () => cancelAnimationFrame(rafRef.current);
  }, [dados]);

  useEffect(() => {
    if (lote * TAMANHO_LOTE >= dados.length) return;
    rafRef.current = requestAnimationFrame(() => setLote((l) => l + 1));
    return () => cancelAnimationFrame(rafRef.current);
  }, [lote, dados.length]);

  const pontosVisiveis = dados.slice(0, lote * TAMANHO_LOTE);
  const progresso = dados.length > 0 ? Math.min(100, (pontosVisiveis.length / dados.length) * 100) : 100;

  return (
    <>
      <ProgressBar valor={progresso} />
      {pontosVisiveis.map((item) => (
        <CircleMarker
          key={item.id}
          center={[item.lat, item.lon]}
          radius={6}
          pathOptions={{
            color: "rgba(0,0,0,0.25)",
            weight: 1,
            fillColor: corParaCategoria(item[atributoCor]),
            fillOpacity: 0.85,
          }}
          eventHandlers={{ click: () => onSelecionarLeitura(item.id) }}
        >
          <Popup minWidth={280}>
            <MarkerPopup resumo={item} />
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

export const ClusterLayer = memo(ClusterLayerImpl);
