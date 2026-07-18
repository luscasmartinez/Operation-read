import { toPng } from "html-to-image";
import { useCallback, useState, type RefObject } from "react";
import { useMap } from "react-leaflet";

interface MapControlsProps {
  camada: "padrao" | "satelite";
  onMudarCamada: (camada: "padrao" | "satelite") => void;
  heatmapAtivo: boolean;
  onToggleHeatmap: () => void;
  medindoDistancia: boolean;
  onToggleMedicao: () => void;
  containerRef: RefObject<HTMLDivElement>;
}

function ControlButton({
  ativo,
  onClick,
  children,
  titulo,
}: {
  ativo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  titulo: string;
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors ${
        ativo
          ? "border-accent bg-accent/20 text-accent"
          : "border-panel-border bg-panel-light text-slate-300 hover:bg-panel-border"
      }`}
    >
      {children}
    </button>
  );
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-panel-border bg-panel-light shadow-panel">
      <button
        onClick={() => map.zoomIn()}
        className="flex h-9 w-9 items-center justify-center text-lg text-slate-300 hover:bg-panel-border"
      >
        +
      </button>
      <div className="h-px bg-panel-border" />
      <button
        onClick={() => map.zoomOut()}
        className="flex h-9 w-9 items-center justify-center text-lg text-slate-300 hover:bg-panel-border"
      >
        −
      </button>
    </div>
  );
}

export function MapControls({
  camada,
  onMudarCamada,
  heatmapAtivo,
  onToggleHeatmap,
  medindoDistancia,
  onToggleMedicao,
  containerRef,
}: MapControlsProps) {
  const map = useMap();
  const [exportando, setExportando] = useState(false);
  const [localizando, setLocalizando] = useState(false);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, [containerRef]);

  const handleExportPng = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    setExportando(true);
    try {
      const dataUrl = await toPng(el, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "mapa_aegea.png";
      link.href = dataUrl;
      link.click();
    } finally {
      setExportando(false);
    }
  }, [containerRef]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
        setLocalizando(false);
      },
      () => setLocalizando(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [map]);

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      <div className="pointer-events-auto">
        <ZoomControls />
      </div>

      <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-panel-border bg-panel-light p-1 shadow-panel">
        <ControlButton
          titulo="Modo satélite"
          ativo={camada === "satelite"}
          onClick={() => onMudarCamada(camada === "satelite" ? "padrao" : "satelite")}
        >
          🛰️
        </ControlButton>
        <ControlButton titulo="Heatmap" ativo={heatmapAtivo} onClick={onToggleHeatmap}>
          🔥
        </ControlButton>
        <ControlButton titulo="Medir distância" ativo={medindoDistancia} onClick={onToggleMedicao}>
          📏
        </ControlButton>
        <ControlButton titulo="Minha localização" onClick={handleLocate}>
          {localizando ? "…" : "📍"}
        </ControlButton>
        <ControlButton titulo="Tela cheia" onClick={handleFullscreen}>
          ⛶
        </ControlButton>
        <ControlButton titulo="Exportar mapa (PNG)" onClick={handleExportPng}>
          {exportando ? "…" : "🖼️"}
        </ControlButton>
      </div>
    </div>
  );
}
