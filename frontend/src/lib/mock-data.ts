export type RestorationStatus =
  | "plantio_recente"
  | "em_restauracao"
  | "recuperada";

export type Biome = "Mata Atlântica" | "Cerrado" | "Amazônia";

export interface MonitoringPhoto {
  id: string;
  /** Curto rótulo da época da foto, ex.: "jan/22" */
  label: string;
  /** Índice na paleta de placeholders de foto */
  tone: number;
}

export interface Monitoring {
  id: string;
  /** Data ISO da visita */
  date: string;
  author: string;
  notes: string;
  seedling_count: number;
  avg_height: number;
  species: string[];
  photos: MonitoringPhoto[];
}

export interface Area {
  id: string;
  name: string;
  biome: Biome;
  size_hectares: number;
  restoration_status: RestorationStatus;
  /** Data ISO de início do projeto de restauração */
  started_at: string;
  goal: string;
  seedlings: number;
  survival_rate: number;
  monitorings: Monitoring[];
}

export interface SensorSeries {
  id: "temperatura" | "umidade" | "chuva" | "luminosidade" | "ar";
  label: string;
  unit: string;
  value: number;
  decimals?: number;
  trend: number[];
}

export const ORGANIZATION = {
  name: "Instituto Folha Verde",
  slug: "folha-verde",
};

export const AREAS: Area[] = [
  {
    id: "area-borrazois",
    name: "Borrazóis",
    biome: "Mata Atlântica",
    size_hectares: 42,
    restoration_status: "em_restauracao",
    started_at: "2019-04-12",
    goal: "Reconectar o fragmento florestal à mata ciliar do ribeirão.",
    seedlings: 3180,
    survival_rate: 91,
    monitorings: [
      {
        id: "mon-bor-01",
        date: "2019-06-20",
        author: "Carla Nunes",
        notes:
          "Plantio de 980 mudas concluído no quadrante 1, com adubação de cova.",
        seedling_count: 980,
        avg_height: 0.4,
        species: ["Aroeira", "Ipê-amarelo", "Angico"],
        photos: [
          { id: "bor-p1", label: "jun/19", tone: 0 },
          { id: "bor-p2", label: "jun/19", tone: 1 },
        ],
      },
      {
        id: "mon-bor-02",
        date: "2020-09-15",
        author: "Carla Nunes",
        notes:
          "Sobrevivência acima do esperado após o primeiro ano seco. Capina de coroamento retomada no setor 2.",
        seedling_count: 920,
        avg_height: 1.1,
        species: ["Aroeira", "Embaúba", "Cedro"],
        photos: [{ id: "bor-p3", label: "set/20", tone: 2 }],
      },
      {
        id: "mon-bor-03",
        date: "2021-11-08",
        author: "Pedro Lima",
        notes:
          "Regeneração natural aparecendo fora das linhas de plantio — bom sinal de conexão com o fragmento.",
        seedling_count: 870,
        avg_height: 1.9,
        species: ["Embaúba", "Cedro", "Jacarandá"],
        photos: [
          { id: "bor-p4", label: "nov/21", tone: 0 },
          { id: "bor-p5", label: "nov/21", tone: 3 },
        ],
      },
      {
        id: "mon-bor-04",
        date: "2022-05-03",
        author: "Pedro Lima",
        notes:
          "Formiga cortadeira ativa no setor 3, perto da trilha leste. Controle localizado programado.",
        seedling_count: 820,
        avg_height: 2.6,
        species: ["Aroeira", "Cedro", "Quaresmeira"],
        photos: [{ id: "bor-p6", label: "mai/22", tone: 1 }],
      },
      {
        id: "mon-bor-05",
        date: "2024-02-27",
        author: "Ana Souza",
        notes:
          "Copa fechando no quadrante 1, início de serapilheira contínua. Medições de altura retomadas.",
        seedling_count: 780,
        avg_height: 4.2,
        species: ["Aroeira", "Cedro", "Copaíba"],
        photos: [
          { id: "bor-p7", label: "fev/24", tone: 2 },
          { id: "bor-p8", label: "fev/24", tone: 0 },
        ],
      },
      {
        id: "mon-bor-06",
        date: "2025-08-04",
        author: "Ana Souza",
        notes:
          "Vistoria de rotina. Sem sinais de fogo ou pastoreio. Trilha leste aberta para visitas.",
        seedling_count: 760,
        avg_height: 5.1,
        species: ["Aroeira", "Copaíba", "Jatobá"],
        photos: [{ id: "bor-p9", label: "ago/25", tone: 3 }],
      },
    ],
  },
  {
    id: "area-serra-verde",
    name: "Serra Verde",
    biome: "Cerrado",
    size_hectares: 18,
    restoration_status: "plantio_recente",
    started_at: "2025-01-15",
    goal: "Recuperar a encosta degradada com espécies nativas do cerrado.",
    seedlings: 920,
    survival_rate: 84,
    monitorings: [
      {
        id: "mon-sv-01",
        date: "2025-01-16",
        author: "Bia Santos",
        notes:
          "Plantio de 520 mudas concluído. Irrigação de pegamento nos primeiros 60 dias.",
        seedling_count: 520,
        avg_height: 0.3,
        species: ["Pequi", "Gabiroba", "Angico"],
        photos: [{ id: "sv-p1", label: "jan/25", tone: 1 }],
      },
      {
        id: "mon-sv-02",
        date: "2025-06-20",
        author: "Bia Santos",
        notes:
          "Perda concentrada na crista da encosta. Reposição de 60 mudas agendada para o início das chuvas.",
        seedling_count: 480,
        avg_height: 0.7,
        species: ["Pequi", "Gabiroba", "Angico"],
        photos: [
          { id: "sv-p2", label: "jun/25", tone: 2 },
          { id: "sv-p3", label: "jun/25", tone: 0 },
        ],
      },
    ],
  },
  {
    id: "area-lagoa-funda",
    name: "Lagoa Funda",
    biome: "Mata Atlântica",
    size_hectares: 30,
    restoration_status: "em_restauracao",
    started_at: "2021-02-10",
    goal: "Restaurar o entorno da lagoa e estabilizar a margem.",
    seedlings: 2100,
    survival_rate: 88,
    monitorings: [
      {
        id: "mon-lf-01",
        date: "2021-03-05",
        author: "Carla Nunes",
        notes:
          "Plantio concluído com espécies de margem: embaúba, ingá e aroeira.",
        seedling_count: 640,
        avg_height: 0.5,
        species: ["Embaúba", "Ingá", "Aroeira"],
        photos: [{ id: "lf-p1", label: "mar/21", tone: 2 }],
      },
      {
        id: "mon-lf-02",
        date: "2022-08-18",
        author: "Pedro Lima",
        notes:
          "Mata-cavalo crescendo rápido na borda da lagoa. Sombreamento reduzindo as gramíneas invasoras.",
        seedling_count: 610,
        avg_height: 2.1,
        species: ["Ingá", "Embaúba", "Mata-cavalo"],
        photos: [
          { id: "lf-p2", label: "ago/22", tone: 0 },
          { id: "lf-p3", label: "ago/22", tone: 3 },
        ],
      },
      {
        id: "mon-lf-03",
        date: "2023-11-30",
        author: "Ana Souza",
        notes:
          "Mergulhão encontrado na lagoa — sinal de recuperação da fauna local.",
        seedling_count: 590,
        avg_height: 3.3,
        species: ["Ingá", "Aroeira", "Cedro"],
        photos: [{ id: "lf-p4", label: "nov/23", tone: 1 }],
      },
      {
        id: "mon-lf-04",
        date: "2025-02-12",
        author: "Ana Souza",
        notes:
          "Vistoria de pós-chuva. Sem erosão nas margens. Medição de nível de água registrada.",
        seedling_count: 570,
        avg_height: 4.4,
        species: ["Ingá", "Cedro", "Jatobá"],
        photos: [
          { id: "lf-p5", label: "fev/25", tone: 2 },
          { id: "lf-p6", label: "fev/25", tone: 0 },
        ],
      },
    ],
  },
  {
    id: "area-riacho-limpo",
    name: "Riacho Limpo",
    biome: "Mata Atlântica",
    size_hectares: 22,
    restoration_status: "recuperada",
    started_at: "2016-06-01",
    goal: "Recuperar a mata ciliar e o curso d'água.",
    seedlings: 1850,
    survival_rate: 94,
    monitorings: [
      {
        id: "mon-rl-01",
        date: "2016-08-20",
        author: "Carla Nunes",
        notes:
          "Primeira fase de plantio ciliar concluída ao longo de 3 km de riacho.",
        seedling_count: 720,
        avg_height: 0.6,
        species: ["Aroeira", "Ingá", "Embaúba"],
        photos: [{ id: "rl-p1", label: "ago/16", tone: 3 }],
      },
      {
        id: "mon-rl-02",
        date: "2018-04-11",
        author: "Pedro Lima",
        notes:
          "Copa fechada em trechos. Presença de aves frugívoras dispersando sementes.",
        seedling_count: 680,
        avg_height: 3.8,
        species: ["Aroeira", "Ingá", "Cedro"],
        photos: [
          { id: "rl-p2", label: "abr/18", tone: 1 },
          { id: "rl-p3", label: "abr/18", tone: 0 },
        ],
      },
      {
        id: "mon-rl-03",
        date: "2020-10-09",
        author: "Ana Souza",
        notes:
          "Monitoramento de fauna: pacas e tatus registrados nas armadilhas de pegada.",
        seedling_count: 660,
        avg_height: 6.2,
        species: ["Aroeira", "Cedro", "Copaíba"],
        photos: [{ id: "rl-p4", label: "out/20", tone: 2 }],
      },
      {
        id: "mon-rl-04",
        date: "2022-07-14",
        author: "Ana Souza",
        notes:
          "Área entrando em fase de manutenção leve. Podas de condução em andamento.",
        seedling_count: 640,
        avg_height: 8.4,
        species: ["Copaíba", "Jatobá", "Cedro"],
        photos: [{ id: "rl-p5", label: "jul/22", tone: 0 }],
      },
      {
        id: "mon-rl-05",
        date: "2024-09-05",
        author: "Bia Santos",
        notes:
          "Área classificada como recuperada. Monitoramento passa a ser anual.",
        seedling_count: 620,
        avg_height: 10.1,
        species: ["Copaíba", "Jatobá", "Ipê-roxo"],
        photos: [
          { id: "rl-p6", label: "set/24", tone: 3 },
          { id: "rl-p7", label: "set/24", tone: 1 },
        ],
      },
    ],
  },
  {
    id: "area-cabeceira",
    name: "Cabeceira do Mato",
    biome: "Cerrado",
    size_hectares: 16,
    restoration_status: "em_restauracao",
    started_at: "2020-03-25",
    goal: "Proteger a nascente e recompor o campo sujo degradado.",
    seedlings: 1380,
    survival_rate: 86,
    monitorings: [
      {
        id: "mon-cm-01",
        date: "2020-04-02",
        author: "Bia Santos",
        notes:
          "Plantio de adensamento concluído no entorno imediato da nascente.",
        seedling_count: 420,
        avg_height: 0.4,
        species: ["Pequi", "Gabiroba", "Angico"],
        photos: [{ id: "cm-p1", label: "abr/20", tone: 2 }],
      },
      {
        id: "mon-cm-02",
        date: "2021-06-17",
        author: "Pedro Lima",
        notes:
          "Cerca de proteção da nascente substituída. Gado não entrou mais.",
        seedling_count: 400,
        avg_height: 1.4,
        species: ["Angico", "Gabiroba", "Pau-terra"],
        photos: [
          { id: "cm-p2", label: "jun/21", tone: 0 },
          { id: "cm-p3", label: "jun/21", tone: 1 },
        ],
      },
      {
        id: "mon-cm-03",
        date: "2022-10-06",
        author: "Ana Souza",
        notes:
          "Nascente com fluxo contínuo na estação seca pela primeira vez desde 2018.",
        seedling_count: 390,
        avg_height: 2.2,
        species: ["Pau-terra", "Angico", "Quaresmeira"],
        photos: [{ id: "cm-p4", label: "out/22", tone: 3 }],
      },
      {
        id: "mon-cm-04",
        date: "2023-08-23",
        author: "Bia Santos",
        notes:
          "Fogo de origem externa atingiu a borda sul. Perda estimada em 2% do plantio.",
        seedling_count: 380,
        avg_height: 3.0,
        species: ["Angico", "Pau-terra"],
        photos: [
          { id: "cm-p5", label: "ago/23", tone: 1 },
          { id: "cm-p6", label: "ago/23", tone: 2 },
        ],
      },
      {
        id: "mon-cm-05",
        date: "2025-04-09",
        author: "Ana Souza",
        notes:
          "Rebrota satisfatória após o fogo. Aceiro externo mantido em toda a borda.",
        seedling_count: 370,
        avg_height: 3.9,
        species: ["Angico", "Pau-terra", "Pequi"],
        photos: [{ id: "cm-p7", label: "abr/25", tone: 0 }],
      },
    ],
  },
];

export const SENSORS: SensorSeries[] = [
  {
    id: "temperatura",
    label: "Temperatura",
    unit: "°C",
    value: 26.4,
    decimals: 1,
    trend: [24.8, 25.1, 25.9, 26.2, 26.0, 26.4],
  },
  {
    id: "umidade",
    label: "Umidade do solo",
    unit: "%",
    value: 72,
    trend: [68, 70, 71, 69, 72, 71],
  },
  {
    id: "chuva",
    label: "Chuva (dia)",
    unit: "mm",
    value: 0,
    decimals: 1,
    trend: [2.1, 0, 0, 0.4, 0, 0],
  },
  {
    id: "luminosidade",
    label: "Luminosidade",
    unit: "klx",
    value: 41,
    decimals: 0,
    trend: [28, 35, 39, 42, 40, 41],
  },
  {
    id: "ar",
    label: "Qualidade do ar",
    unit: "aqi",
    value: 22,
    trend: [26, 24, 23, 25, 21, 22],
  },
];

export interface DashboardStat {
  value: number;
  label: string;
  suffix?: string;
}

export const DASHBOARD_STATS: DashboardStat[] = [
  { value: 128, suffix: "ha", label: "área monitorada" },
  { value: 12847, label: "mudas plantadas" },
  { value: 5, label: "áreas ativas" },
  { value: 89, suffix: "%", label: "sobrevivência média" },
  { value: 2401, label: "fotos no acervo" },
];

export const STATUS_LABEL: Record<RestorationStatus, string> = {
  plantio_recente: "Plantio recente",
  em_restauracao: "Em restauração",
  recuperada: "Recuperada",
};
