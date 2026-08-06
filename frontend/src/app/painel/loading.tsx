export default function PainelLoading() {
  return (
    <div className="space-y-12" aria-label="Carregando painel">
      <div>
        <div className="h-3 w-56 animate-pulse rounded-full bg-forest/10" />
        <div className="mt-4 h-9 w-48 animate-pulse rounded-xl bg-forest/10" />
        <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded-full bg-forest/10" />
      </div>

      <div className="h-24 animate-pulse rounded-2xl bg-forest/10" />

      <div className="h-24 animate-pulse rounded-2xl bg-forest/10" />

      <div className="space-y-6">
        <div className="h-3 w-56 animate-pulse rounded-full bg-forest/10" />
        <div className="h-4 w-72 animate-pulse rounded-full bg-forest/10" />
        <div className="h-40 animate-pulse rounded-2xl bg-forest/10" />
        <div className="h-40 animate-pulse rounded-2xl bg-forest/10" />
      </div>
    </div>
  );
}
