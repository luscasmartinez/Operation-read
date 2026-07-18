interface ProgressBarProps {
  valor: number; // 0–100
}

export function ProgressBar({ valor }: ProgressBarProps) {
  if (valor >= 100) return null;
  return (
    <div className="absolute left-0 right-0 top-0 z-[2000] h-1 bg-panel-border">
      <div
        className="h-full bg-accent transition-[width] duration-75"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}
