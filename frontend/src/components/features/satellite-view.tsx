import { MapPin, Satellite } from 'lucide-react'
import type { AreaRead } from '@/lib/api'

interface SatelliteViewProps {
   area: AreaRead
}

function coordinatesLabel(area: AreaRead): string {
   const coords = area.coordinates as { latitude?: number; longitude?: number } | null | undefined
   if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
      return `${Math.abs(coords.latitude).toFixed(2)}° ${
         coords.latitude >= 0 ? 'S' : 'N'
      } · ${Math.abs(coords.longitude).toFixed(2)}° ${coords.longitude >= 0 ? 'W' : 'E'}`
   }
   return 'coordenadas em breve'
}

export function SatelliteView({ area }: SatelliteViewProps) {
   return (
      <section aria-labelledby="satellite-title" className="max-w-6xl">
         <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
               <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">Imagem de satélite</p>
               {/* <h2
            id="satellite-title"
            className="font-heading mt-3 text-2xl leading-[1.1] tracking-tight text-forest sm:text-3xl"
          >
            Visão de satélite
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-moss">
            O perímetro desta área sobre a imagem orbital. Pré-visualização — a
            imagem real ainda não está disponível.
          </p> */}
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest">
               <Satellite className="h-3.5 w-3.5" aria-hidden="true" />
               Pré-visualização
            </span>
         </div>

         <div className="mt-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream shadow-sm shadow-forest/5">
            <div className="soil-gradient relative aspect-[16/11] w-full sm:aspect-[16/8]">
               <div
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                     backgroundImage:
                        'linear-gradient(to right, rgba(181,201,176,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(181,201,176,0.07) 1px, transparent 1px)',
                     backgroundSize: '48px 48px',
                  }}
               />
               <svg
                  viewBox="0 0 100 60"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-[8%] h-[84%] w-[84%]"
               >
                  <polygon
                     points="18,12 80,8 88,48 26,54 14,30"
                     fill="rgba(196,167,108,0.06)"
                     stroke="rgba(196,167,108,0.8)"
                     strokeWidth="0.5"
                     strokeDasharray="2 1.5"
                  />
                  <polygon
                     points="24,18 74,14 80,44 31,49 21,31"
                     fill="none"
                     stroke="rgba(181,201,176,0.35)"
                     strokeWidth="0.3"
                     strokeDasharray="1 2"
                  />
               </svg>

               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span
                     aria-hidden="true"
                     className="live-dot absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/30"
                  />
                  <MapPin className="relative h-6 w-6 text-gold" aria-hidden="true" />
               </div>

               <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
                  <p className="font-heading text-lg tracking-tight text-cream/90">{area.name}</p>
                  <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-cream/50">
                     polígono aproximado
                  </p>
               </div>

               <div className="absolute bottom-4 left-4 flex items-center gap-2 sm:bottom-5 sm:left-5">
                  <span aria-hidden="true" className="block h-px w-10 bg-cream/60" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-cream/70">50 m</span>
               </div>

               <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cream/30 font-mono text-[10px] font-medium text-cream/70">
                     N
                  </span>
               </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-forest/10 bg-cream px-5 py-3.5 sm:px-6">
               <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss/70">
                  {area.biome ?? 'Bioma não informado'} ·{' '}
                  {area.size_hectares != null
                     ? `${area.size_hectares.toLocaleString('pt-BR')} ha`
                     : 'Tamanho não informado'}
               </span>
               <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss/70">
                  {coordinatesLabel(area)}
               </span>
            </div>
         </div>
      </section>
   )
}
