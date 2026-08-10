'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, RefreshCw, User } from 'lucide-react'
import { apiFetch, type ProjectRead } from '@/lib/api'
import { useBreadcrumb } from '@/components/features/painel-breadcrumb'
import { ProjectAreas } from '@/components/features/project-areas'
import { EditProjectDialog } from '@/components/features/edit-project-dialog'
import { DeleteProjectDialog } from '@/components/features/delete-project-dialog'
import { useUser } from '@/components/features/user-provider'
import { canManageOrganization } from '@/lib/user'

function formatDate(value?: string | null): string | null {
   if (!value) return null
   const date = new Date(`${value}T00:00:00`)
   if (Number.isNaN(date.getTime())) return null
   return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
   })
}

export default function ProjectDetailPage() {
   const params = useParams<{ id: string }>()
   const router = useRouter()
   const queryClient = useQueryClient()
   const { organization } = useUser()

   const { data, isPending, isError, refetch } = useQuery({
      queryKey: ['project', params.id],
      queryFn: () => apiFetch<ProjectRead>(`/projects/${params.id}`, { auth: true }),
   })

   const canManage = canManageOrganization(organization?.role)

   useBreadcrumb(data ? ['Projetos', data.name] : ['Projetos'])

   function handleUpdated(updated: ProjectRead) {
      queryClient.setQueryData(['project', params.id], updated)
   }

   function handleDeleted() {
      queryClient.removeQueries({ queryKey: ['project', params.id] })
      queryClient.removeQueries({ queryKey: ['areas', params.id] })
      queryClient.invalidateQueries({ queryKey: ['projects', organization?.id ?? 'all'] })
      router.push('/painel/projetos')
   }

   if (isPending) {
      return (
         <div role="status" aria-label="Carregando projeto" className="max-w-6xl space-y-4">
            <div className="h-4 w-24 animate-pulse rounded-full bg-forest/10" />
            <div className="h-8 w-1/2 animate-pulse rounded-md bg-forest/10" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-forest/8" />
            <div className="h-3 w-1/2 animate-pulse rounded-full bg-forest/8" />
         </div>
      )
   }

   if (isError || !data) {
      return (
         <div
            role="alert"
            className="max-w-6xl rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center"
         >
            <h1 className="font-heading text-xl tracking-tight text-forest">Não foi possível carregar o projeto</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-moss">
               Verifique sua conexão e tente novamente.
            </p>
            <button
               type="button"
               onClick={() => refetch()}
               className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-medium text-cream transition-all duration-300 hover:bg-forest/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
               <RefreshCw className="h-4 w-4" aria-hidden="true" />
               Tentar novamente
            </button>
         </div>
      )
   }

   const startLabel = formatDate(data.start_date)

   return (
      <div className="max-w-6xl space-y-8">
         <Link
            href="/painel/projetos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-moss transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
         >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para projetos
         </Link>

         <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
               <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-gold">Projeto</p>
               <h1 className="font-heading mt-3 text-3xl leading-[1.05] tracking-tight text-forest sm:text-4xl">
                  {data.name}
               </h1>
            </div>
            {canManage ? (
               <div className="flex items-center gap-2">
                  <EditProjectDialog project={data} onUpdated={handleUpdated} />
                  <DeleteProjectDialog
                     projectId={data.id}
                     projectName={data.name}
                     onDeleted={handleDeleted}
                  />
               </div>
            ) : null}
         </header>

         {data.goal || data.description ? (
            <section className="max-w-6xl rounded-2xl border border-forest/10 bg-cream p-6 shadow-sm shadow-forest/5 sm:p-8">
               {data.goal ? (
                  <div>
                     <h2 className="font-heading text-xl tracking-tight text-forest">Objetivo</h2>
                     <p className="mt-2 text-sm leading-relaxed text-moss">{data.goal}</p>
                  </div>
               ) : null}
               {data.description ? (
                  <div className={data.goal ? 'mt-6' : undefined}>
                     <h2 className="font-heading text-xl tracking-tight text-forest">Descrição</h2>
                     <p className="mt-2 text-sm leading-relaxed text-moss">{data.description}</p>
                  </div>
               ) : null}
            </section>
         ) : null}

         <dl className="grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
            {startLabel ? (
               <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
                  <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
                     <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                     Início
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-forest">{startLabel}</dd>
               </div>
            ) : null}
            {data.responsible ? (
               <div className="rounded-2xl border border-forest/10 bg-cream px-5 py-4 shadow-sm shadow-forest/5">
                  <dt className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-gold">
                     <User className="h-3.5 w-3.5" aria-hidden="true" />
                     Responsável
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-forest">{data.responsible}</dd>
               </div>
            ) : null}
         </dl>

         <ProjectAreas projectId={params.id} />
      </div>
   )
}
