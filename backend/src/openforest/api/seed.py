from __future__ import annotations

import argparse
import random
import struct
import zlib
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from uuid import UUID

from sqlmodel import Session, select, text

from openforest.api.config import settings
from openforest.api.infrastructure.database import engine
from openforest.api.infrastructure.geometry import to_geometry
from openforest.api.infrastructure.storage import delete_photo_prefix, save_upload
from openforest.api.models.area import Area, RestorationStatus
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.organization import Organization
from openforest.api.models.photo import Photo
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.services.auth_service import hash_password

DEFAULT_PASSWORD = "openforest123"
SUPERUSER_EMAIL = "admin@openforest.dev"

_PLACEHOLDER_WIDTH = 1920
_PLACEHOLDER_HEIGHT = 1080
_PLACEHOLDER_PNG_CACHE: bytes | None = None

_TABLE_NAMES = (
    "photo",
    "monitoring",
    "area",
    "project",
    "user_organization",
    "organization",
    '"user"',
)

_NOTES = (
    "Visita de rotina. Mudas com boa sanidade, presença de formigas cortadeiras no limite do talhão.",
    "Replantio realizado nas áreas com maior mortalidade do mês anterior. Necessária irrigação suplementar.",
    "Cercamento verificado em campo: porteira em bom estado e estacas reforçadas.",
    "Observação de fauna: tucano, saracura e vestígios de capivara na margem do rio.",
    "Período chuvoso intenso; aceiros limpos e sem sinais de erosão.",
    "Coleta de dados biométricos em amostra de 100 mudas para acompanhamento de crescimento.",
    "Mortalidade acima do esperado no quadrante A3, provável déficit hídrico. Replanejamento do plantio.",
    "Preparo do solo e abertura de berços para a próxima etapa de plantio.",
    "Controle de gramíneas invasoras concluído no talhão 2.",
    "Visita técnica com pesquisadores para coleta de dados de biodiversidade.",
    "Rega de emergência após estiagem prolongada na região.",
    "Manutenção da trilha de acesso e limpeza dos aceiros concluídas.",
)

_SPECIES_BY_BIOME: dict[str, list[tuple[str, str]]] = {
    "Cerrado": [
        ("Ipê-Amarelo", "Handroanthus serratifolius"),
        ("Jatobá", "Hymenaea courbaril"),
        ("Pequi", "Caryocar brasiliense"),
        ("Aroeira", "Myracrodruon urundeuva"),
        ("Copaíba", "Copaifera langsdorffii"),
        ("Cedro", "Cedrela fissilis"),
        ("Ipê-Roxo", "Handroanthus impetiginosus"),
        ("Angico", "Anadenanthera peregrina"),
    ],
    "Mata Atlântica": [
        ("Pau-Brasil", "Paubrasilia echinata"),
        ("Jequitibá-Rosa", "Cariniana legalis"),
        ("Cedro-Rosa", "Cedrela fissilis"),
        ("Peroba-Rosa", "Aspidosperma polyneuron"),
        ("Jacarandá-da-Bahia", "Dalbergia nigra"),
        ("Araucária", "Araucaria angustifolia"),
        ("Ipê-Amarelo", "Handroanthus serratifolius"),
        ("Guapuruvu", "Schizolobium parahyba"),
    ],
    "Amazônia": [
        ("Mogno", "Swietenia macrophylla"),
        ("Copaíba", "Copaifera langsdorffii"),
        ("Andiroba", "Carapa guianensis"),
        ("Seringueira", "Hevea brasiliensis"),
        ("Cumaru", "Dipteryx odorata"),
        ("Angelim", "Dinizia excelsa"),
        ("Castanha-do-Pará", "Bertholletia excelsa"),
        ("Ipê", "Handroanthus spp."),
    ],
}


@dataclass(frozen=True)
class SeedUser:
    name: str
    email: str
    role: UserOrganizationRole


@dataclass(frozen=True)
class SeedArea:
    name: str
    size_hectares: float
    status: RestorationStatus
    goal: str | None = None


@dataclass(frozen=True)
class SeedProject:
    name: str
    description: str
    goal: str
    start_date: date
    responsible: str
    areas: list[SeedArea]


@dataclass(frozen=True)
class SeedOrganization:
    name: str
    slug: str
    description: str
    coords: tuple[float, float]
    biome: str
    users: list[SeedUser]
    projects: list[SeedProject]


@dataclass
class SeedReport:
    users_created: int = 0
    users_skipped: int = 0
    organizations_created: int = 0
    organizations_skipped: int = 0
    memberships_created: int = 0
    memberships_skipped: int = 0
    projects_created: int = 0
    projects_skipped: int = 0
    areas_created: int = 0
    areas_skipped: int = 0
    monitorings_created: int = 0
    monitorings_skipped: int = 0
    photos_created: int = 0
    photos_skipped: int = 0


@dataclass(frozen=True)
class _VisitPlan:
    visit_date: date
    seedling_count: int | None
    avg_height: float | None
    species_data: dict[str, object] | None
    notes: str | None
    photo_names: list[str]


@dataclass(frozen=True)
class _AreaPlan:
    area: SeedArea
    geometry: dict[str, object]
    visits: list[_VisitPlan]


@dataclass(frozen=True)
class _ProjectPlan:
    project: SeedProject
    areas: list[_AreaPlan]


@dataclass(frozen=True)
class _OrganizationPlan:
    organization: SeedOrganization
    projects: list[_ProjectPlan]


_ORGANIZATIONS: list[SeedOrganization] = [
    SeedOrganization(
        name="Instituto Verde Vivo",
        slug="instituto-verde-vivo",
        description=(
            "Organização da sociedade civil dedicada à restauração de matas ciliares "
            "no cerrado mato-grossense, com foco em conectividade de corredores ecológicos."
        ),
        coords=(-15.6, -56.1),
        biome="Cerrado",
        users=[
            SeedUser(
                "Ana Beatriz Souza", "ana.souza@verdevivo.org.br", UserOrganizationRole.manager
            ),
            SeedUser(
                "Carlos Mendes", "carlos.mendes@verdevivo.org.br", UserOrganizationRole.researcher
            ),
            SeedUser(
                "Fernanda Lima", "fernanda.lima@verdevivo.org.br", UserOrganizationRole.volunteer
            ),
            SeedUser(
                "Joaquim Ribeiro", "joaquim.ribeiro@verdevivo.org.br", UserOrganizationRole.viewer
            ),
        ],
        projects=[
            SeedProject(
                name="Recuperação do Rio Cuiabá",
                description=(
                    "Restauração de 120 hectares de mata ciliar ao longo de 40 km do Rio Cuiabá, "
                    "com foco em áreas de pastagem degradada e integração com produtores rurais da bacia."
                ),
                goal="Restaurar 120 ha de mata ciliar e garantir a conectividade do corredor até 2028.",
                start_date=date(2024, 1, 20),
                responsible="Ana Beatriz Souza",
                areas=[
                    SeedArea(
                        "Mata Ciliar do Cuiabá – Trecho Norte",
                        18.5,
                        RestorationStatus.active,
                        goal="Restaurar 18,5 ha de mata ciliar no trecho norte do rio.",
                    ),
                    SeedArea(
                        "Mata Ciliar do Cuiabá – Trecho Sul",
                        22.0,
                        RestorationStatus.active,
                        goal="Recuperar 22 ha de mata ciliar no trecho sul, com espécies nativas de várzea.",
                    ),
                    SeedArea(
                        "Talhão 01 – Fazenda Boa Esperança",
                        12.4,
                        RestorationStatus.active,
                        goal="Restaurar 12,4 ha de pastagem degradada com enriquecimento florestal.",
                    ),
                    SeedArea(
                        "Talhão 02 – Fazenda Boa Esperança",
                        15.8,
                        RestorationStatus.completed,
                        goal="Consolidar a restauração de 15,8 ha e garantir a regeneração da área.",
                    ),
                    SeedArea(
                        "Quadrante A – Várzea do Cuiabá",
                        9.2,
                        RestorationStatus.planned,
                        goal="Implantar a restauração de 9,2 ha na várzea do quadrante A.",
                    ),
                    SeedArea(
                        "Quadrante B – Várzea do Cuiabá",
                        11.0,
                        RestorationStatus.active,
                        goal="Restaurar 11 ha de várzea no quadrante B, garantindo a conectividade do corredor.",
                    ),
                ],
            ),
            SeedProject(
                name="Corredor Ecológico da Chapada",
                description=(
                    "Conecta fragmentos de cerrado entre a Chapada dos Guimarães e a várzea do "
                    "Rio Cuiabá por meio de faixas de restauração e enriquecimento florestal."
                ),
                goal="Conectar os fragmentos da Chapada à várzea do Rio Cuiabá.",
                start_date=date(2025, 3, 10),
                responsible="Carlos Mendes",
                areas=[
                    SeedArea(
                        "Fragmento 01 – Serra da Chapada",
                        7.5,
                        RestorationStatus.active,
                        goal="Restaurar 7,5 ha no fragmento da Serra da Chapada.",
                    ),
                    SeedArea(
                        "Fragmento 02 – Córrego da Onça",
                        6.3,
                        RestorationStatus.planned,
                        goal="Recuperar 6,3 ha de mata ciliar no Córrego da Onça.",
                    ),
                    SeedArea(
                        "Conectivo – Estrada do Ribeirão",
                        14.7,
                        RestorationStatus.active,
                        goal="Implantar faixa de conectividade de 14,7 ha ao longo da Estrada do Ribeirão.",
                    ),
                ],
            ),
        ],
    ),
    SeedOrganization(
        name="Associação Mata Atlântica",
        slug="associacao-mata-atlantica",
        description=(
            "Associação voltada à recuperação de remanescentes florestais e corredores "
            "ecológicos na Mata Atlântica paulista, em parceria com RPPNs e produtores rurais."
        ),
        coords=(-23.55, -46.63),
        biome="Mata Atlântica",
        users=[
            SeedUser(
                "Ricardo Tavares",
                "ricardo.tavares@mataatlantica.org.br",
                UserOrganizationRole.manager,
            ),
            SeedUser(
                "Marina Duarte",
                "marina.duarte@mataatlantica.org.br",
                UserOrganizationRole.researcher,
            ),
            SeedUser(
                "Lucas Almeida",
                "lucas.almeida@mataatlantica.org.br",
                UserOrganizationRole.volunteer,
            ),
            SeedUser(
                "Patrícia Costa",
                "patricia.costa@mataatlantica.org.br",
                UserOrganizationRole.volunteer,
            ),
        ],
        projects=[
            SeedProject(
                name="Corredor do Tietê",
                description=(
                    "Reconexão de fragmentos de Mata Atlântica na várzea do médio Tietê, "
                    "priorizando matas ciliares e áreas de preservação permanente."
                ),
                goal="Reconectar os fragmentos da várzea do Tietê até 2027.",
                start_date=date(2023, 9, 15),
                responsible="Ricardo Tavares",
                areas=[
                    SeedArea(
                        "Várzea do Tietê – Núcleo 01",
                        20.0,
                        RestorationStatus.active,
                        goal="Restaurar 20 ha de várzea no núcleo 01.",
                    ),
                    SeedArea(
                        "Várzea do Tietê – Núcleo 02",
                        24.5,
                        RestorationStatus.active,
                        goal="Restaurar 24,5 ha de várzea no núcleo 02.",
                    ),
                    SeedArea(
                        "Talhão Leste – Pindamonhangaba",
                        16.2,
                        RestorationStatus.completed,
                        goal="Consolidar a restauração de 16,2 ha do talhão leste.",
                    ),
                    SeedArea(
                        "Talhão Oeste – Jacareí",
                        13.8,
                        RestorationStatus.active,
                        goal="Recuperar 13,8 ha de mata ciliar no talhão oeste.",
                    ),
                    SeedArea(
                        "Margem Esquerda – Bairro Rural",
                        8.9,
                        RestorationStatus.cancelled,
                        goal="Recuperar 8,9 ha na margem esquerda, junto ao bairro rural.",
                    ),
                ],
            ),
            SeedProject(
                name="RPPN Serra do Mar",
                description=(
                    "Consolidação da restauração da Reserva Particular do Patrimônio Natural "
                    "Serra do Mar, com acompanhamento da regeneração natural das encostas."
                ),
                goal="Consolidar a restauração da RPPN e monitorar a regeneração natural.",
                start_date=date(2022, 5, 30),
                responsible="Marina Duarte",
                areas=[
                    SeedArea(
                        "Núcleo Pioneiro – RPPN",
                        30.0,
                        RestorationStatus.completed,
                        goal="Manter consolidada a restauração dos 30 ha do núcleo pioneiro.",
                    ),
                    SeedArea(
                        "Encosta Sul – RPPN",
                        25.6,
                        RestorationStatus.completed,
                        goal="Monitorar a regeneração natural de 25,6 ha da encosta sul.",
                    ),
                    SeedArea(
                        "Regeneração Natural – RPPN",
                        40.0,
                        RestorationStatus.active,
                        goal="Acompanhar e enriquecer a regeneração natural em 40 ha.",
                    ),
                ],
            ),
            SeedProject(
                name="Mata Ciliar do Alto Paranapanema",
                description=(
                    "Implantação de corredor ripário no Alto Paranapanema com espécies "
                    "nativas e enriquecimento com frutíferas."
                ),
                goal="Implantar corredor ripário de 30 ha no Alto Paranapanema.",
                start_date=date(2025, 1, 12),
                responsible="Ricardo Tavares",
                areas=[
                    SeedArea(
                        "Área 01 – Rio Paranapanema",
                        12.1,
                        RestorationStatus.active,
                        goal="Implantar 12,1 ha de corredor ripário no Rio Paranapanema.",
                    ),
                    SeedArea(
                        "Área 02 – Ribeirão do Veado",
                        9.7,
                        RestorationStatus.planned,
                        goal="Restaurar 9,7 ha de mata ciliar no Ribeirão do Veado.",
                    ),
                    SeedArea(
                        "Área 03 – Córrego das Antas",
                        11.4,
                        RestorationStatus.active,
                        goal="Recuperar 11,4 ha de mata ciliar no Córrego das Antas.",
                    ),
                ],
            ),
        ],
    ),
    SeedOrganization(
        name="Fundação Água Viva",
        slug="fundacao-agua-viva",
        description=(
            "Fundação que atua na proteção de nascentes e na recuperação de áreas degradadas "
            "na Amazônia paraense, com foco em bacias hidrográficas."
        ),
        coords=(-1.45, -48.48),
        biome="Amazônia",
        users=[
            SeedUser(
                "Sofia Cardoso", "sofia.cardoso@aguaviva.org.br", UserOrganizationRole.manager
            ),
            SeedUser(
                "Bruno Ferreira", "bruno.ferreira@aguaviva.org.br", UserOrganizationRole.researcher
            ),
            SeedUser(
                "Helena Martins", "helena.martins@aguaviva.org.br", UserOrganizationRole.volunteer
            ),
        ],
        projects=[
            SeedProject(
                name="Nascentes do Araguaia",
                description=(
                    "Proteção e restauração de nascentes na bacia do Araguaia, com cercamento, "
                    "plantio de mata ciliar e participação das comunidades ribeirinhas."
                ),
                goal="Proteger 40 nascentes e restaurar 80 hectares no entorno.",
                start_date=date(2024, 4, 5),
                responsible="Sofia Cardoso",
                areas=[
                    SeedArea(
                        "Nascente 07 – Baía do Capim",
                        8.2,
                        RestorationStatus.active,
                        goal="Restaurar 8,2 ha no entorno da Nascente 07.",
                    ),
                    SeedArea(
                        "Nascente 12 – Foz do Arara",
                        10.5,
                        RestorationStatus.active,
                        goal="Proteger e restaurar 10,5 ha no entorno da Nascente 12.",
                    ),
                    SeedArea(
                        "Nascente 23 – Lagoa das Garças",
                        9.0,
                        RestorationStatus.completed,
                        goal="Consolidar a restauração de 9 ha na Nascente 23.",
                    ),
                    SeedArea(
                        "Nascente 31 – Igarapé Açu",
                        7.8,
                        RestorationStatus.planned,
                        goal="Implantar a restauração de 7,8 ha na Nascente 31.",
                    ),
                ],
            ),
            SeedProject(
                name="Recuperação da Várzea do Tocantins",
                description=(
                    "Restauração de várzeas inundáveis do baixo Tocantins com espécies nativas "
                    "adaptadas a ciclos de cheia."
                ),
                goal="Recuperar 60 ha de várzea com espécies nativas da Amazônia.",
                start_date=date(2025, 2, 18),
                responsible="Bruno Ferreira",
                areas=[
                    SeedArea(
                        "Várzea 01 – Cametá",
                        15.3,
                        RestorationStatus.active,
                        goal="Restaurar 15,3 ha de várzea em Cametá com espécies adaptadas às cheias.",
                    ),
                    SeedArea(
                        "Várzea 02 – Mocajuba",
                        12.6,
                        RestorationStatus.active,
                        goal="Recuperar 12,6 ha de várzea em Mocajuba.",
                    ),
                    SeedArea(
                        "Ilha do Pacoval",
                        18.9,
                        RestorationStatus.planned,
                        goal="Restaurar 18,9 ha de várzea na Ilha do Pacoval.",
                    ),
                ],
            ),
        ],
    ),
    SeedOrganization(
        name="Prefeitura de Manaus",
        slug="prefeitura-de-manaus",
        description=(
            "Secretaria Municipal de Meio Ambiente de Manaus, responsável pelo programa "
            "de reflorestamento urbano e conservação de áreas verdes e igarapés."
        ),
        coords=(-3.11, -60.02),
        biome="Amazônia",
        users=[
            SeedUser(
                "André Nogueira", "andre.nogueira@sema.manaus.gov.br", UserOrganizationRole.manager
            ),
            SeedUser(
                "Paula Castro", "paula.castro@sema.manaus.gov.br", UserOrganizationRole.researcher
            ),
            SeedUser("Wilson Dias", "wilson.dias@sema.manaus.gov.br", UserOrganizationRole.viewer),
        ],
        projects=[
            SeedProject(
                name="Reflorestamento Urbano de Manaus",
                description=(
                    "Programa municipal de arborização e reflorestamento de áreas verdes, "
                    "córregos e parques urbanos da cidade de Manaus."
                ),
                goal="Plantar 500 mil mudas nativas na área urbana até 2030.",
                start_date=date(2023, 1, 25),
                responsible="André Nogueira",
                areas=[
                    SeedArea(
                        "Área Verde – Zona Norte 01",
                        5.4,
                        RestorationStatus.completed,
                        goal="Concluir a arborização de 5,4 ha na Zona Norte 01.",
                    ),
                    SeedArea(
                        "Área Verde – Zona Norte 02",
                        6.1,
                        RestorationStatus.active,
                        goal="Arborizar 6,1 ha de área verde na Zona Norte 02.",
                    ),
                    SeedArea(
                        "Córrego do Mindú – Trecho 1",
                        4.8,
                        RestorationStatus.active,
                        goal="Restaurar 4,8 ha de mata ciliar no Córrego do Mindú (trecho 1).",
                    ),
                    SeedArea(
                        "Córrego do Mindú – Trecho 2",
                        5.9,
                        RestorationStatus.planned,
                        goal="Implantar a restauração de 5,9 ha no Córrego do Mindú (trecho 2).",
                    ),
                    SeedArea(
                        "Parque Cidade da Criança",
                        3.6,
                        RestorationStatus.active,
                        goal="Arborizar 3,6 ha do Parque Cidade da Criança.",
                    ),
                    SeedArea(
                        "Reserva do Sauim – Entorno",
                        8.4,
                        RestorationStatus.active,
                        goal="Restaurar 8,4 ha no entorno da Reserva do Sauim.",
                    ),
                ],
            ),
            SeedProject(
                name="Parque das Tribos",
                description=(
                    "Restauração e arborização do Parque das Tribos, incluindo a mata ciliar "
                    "do igarapé do Gigante e áreas de uso público."
                ),
                goal="Arborizar e restaurar 25 ha do Parque das Tribos.",
                start_date=date(2025, 6, 2),
                responsible="Paula Castro",
                areas=[
                    SeedArea(
                        "Setor Norte – Parque das Tribos",
                        9.3,
                        RestorationStatus.active,
                        goal="Restaurar 9,3 ha no setor norte do parque.",
                    ),
                    SeedArea(
                        "Setor Sul – Parque das Tribos",
                        7.1,
                        RestorationStatus.planned,
                        goal="Implantar a restauração de 7,1 ha no setor sul do parque.",
                    ),
                    SeedArea(
                        "Mata Ciliar – Igarapé do Gigante",
                        6.8,
                        RestorationStatus.active,
                        goal="Recuperar 6,8 ha de mata ciliar do Igarapé do Gigante.",
                    ),
                ],
            ),
        ],
    ),
    SeedOrganization(
        name="Instituto Terra Firme",
        slug="instituto-terra-firme",
        description=(
            "Instituto focado em agrofloresta e recuperação de pastagens degradadas no Acre, "
            "aliando restauração à geração de renda para agricultores familiares."
        ),
        coords=(-9.97, -67.81),
        biome="Amazônia",
        users=[
            SeedUser(
                "Letícia Ramos", "leticia.ramos@terrafirme.org.br", UserOrganizationRole.manager
            ),
            SeedUser("João Pedro", "joao.pedro@terrafirme.org.br", UserOrganizationRole.researcher),
            SeedUser(
                "Camila Santos", "camila.santos@terrafirme.org.br", UserOrganizationRole.volunteer
            ),
            SeedUser(
                "Rafael Oliveira",
                "rafael.oliveira@terrafirme.org.br",
                UserOrganizationRole.volunteer,
            ),
        ],
        projects=[
            SeedProject(
                name="Agrofloresta do Acre",
                description=(
                    "Implantação de sistemas agroflorestais em pastagens degradadas, integrando "
                    "espécies madeiráveis, frutíferas e culturas de renda."
                ),
                goal="Implantar 60 hectares de sistemas agroflorestais em pastagens degradadas.",
                start_date=date(2023, 11, 8),
                responsible="Letícia Ramos",
                areas=[
                    SeedArea(
                        "SAF 01 – Seringal Esperança",
                        12.2,
                        RestorationStatus.active,
                        goal="Implantar 12,2 ha de sistema agroflorestal no Seringal Esperança.",
                    ),
                    SeedArea(
                        "SAF 02 – Ramal do Sapo",
                        10.8,
                        RestorationStatus.completed,
                        goal="Consolidar 10,8 ha de sistema agroflorestal no Ramal do Sapo.",
                    ),
                    SeedArea(
                        "SAF 03 – Fazenda Boa Vista",
                        14.5,
                        RestorationStatus.active,
                        goal="Implantar 14,5 ha de sistema agroflorestal na Fazenda Boa Vista.",
                    ),
                    SeedArea(
                        "SAF 04 – Colônia Rio Branco",
                        9.4,
                        RestorationStatus.planned,
                        goal="Implantar 9,4 ha de sistema agroflorestal na Colônia Rio Branco.",
                    ),
                ],
            ),
            SeedProject(
                name="Recuperação do Rio Acre",
                description=(
                    "Restauração da mata ciliar do Rio Acre em trechos urbanos e rurais, "
                    "com ênfase em controle de erosão e recuperação de barrancos."
                ),
                goal="Restaurar a mata ciliar do Rio Acre ao longo de 45 km.",
                start_date=date(2024, 8, 21),
                responsible="João Pedro",
                areas=[
                    SeedArea(
                        "Mata Ciliar – Porto Acre",
                        16.7,
                        RestorationStatus.active,
                        goal="Restaurar 16,7 ha de mata ciliar em Porto Acre.",
                    ),
                    SeedArea(
                        "Mata Ciliar – Vila do Incra",
                        13.2,
                        RestorationStatus.active,
                        goal="Recuperar 13,2 ha de mata ciliar na Vila do Incra.",
                    ),
                    SeedArea(
                        "Mata Ciliar – Riozinho do Rola",
                        11.9,
                        RestorationStatus.planned,
                        goal="Implantar a restauração de 11,9 ha no Riozinho do Rola.",
                    ),
                ],
            ),
        ],
    ),
    SeedOrganization(
        name="Coop. Agroflorestal do Sul",
        slug="coop-agroflorestal-do-sul",
        description=(
            "Cooperativa de agricultores familiares do Paraná que integra produção agroflorestal "
            "à restauração com Araucária e erva-mate."
        ),
        coords=(-25.43, -49.27),
        biome="Mata Atlântica",
        users=[
            SeedUser(
                "Eduardo Marques",
                "eduardo.marques@agroflorestalsul.coop.br",
                UserOrganizationRole.manager,
            ),
            SeedUser(
                "Talita Gonçalves",
                "talita.goncalves@agroflorestalsul.coop.br",
                UserOrganizationRole.researcher,
            ),
            SeedUser(
                "Marcos Pereira",
                "marcos.pereira@agroflorestalsul.coop.br",
                UserOrganizationRole.volunteer,
            ),
        ],
        projects=[
            SeedProject(
                name="Floresta com Araucárias",
                description=(
                    "Restauração com Araucária angustifolia e erva-mate em sistemas integrados, "
                    "aliando recuperação florestal à produção sustentável."
                ),
                goal="Restaurar 50 hectares com Araucária e erva-mate em sistemas integrados.",
                start_date=date(2024, 2, 14),
                responsible="Eduardo Marques",
                areas=[
                    SeedArea(
                        "Talhão Araucária 01",
                        10.0,
                        RestorationStatus.active,
                        goal="Plantar 10 ha com Araucária angustifolia.",
                    ),
                    SeedArea(
                        "Talhão Araucária 02",
                        12.6,
                        RestorationStatus.completed,
                        goal="Consolidar a restauração de 12,6 ha com Araucária.",
                    ),
                    SeedArea(
                        "Sistema Agroflorestal – Erva-mate",
                        8.3,
                        RestorationStatus.active,
                        goal="Implantar 8,3 ha de sistema agroflorestal com erva-mate.",
                    ),
                    SeedArea(
                        "Mata Ciliar – Rio Iguaçu",
                        9.1,
                        RestorationStatus.active,
                        goal="Restaurar 9,1 ha de mata ciliar do Rio Iguaçu.",
                    ),
                    SeedArea(
                        "Reserva Legal – Sítio Esperança",
                        7.7,
                        RestorationStatus.planned,
                        goal="Implantar a restauração de 7,7 ha na reserva legal.",
                    ),
                ],
            ),
            SeedProject(
                name="Paraná Agroflorestal",
                description=(
                    "Expansão das unidades agroflorestais da cooperativa para novos municípios, "
                    "com intercâmbio de práticas entre os produtores."
                ),
                goal="Expandir as unidades agroflorestais para 30 ha até 2027.",
                start_date=date(2025, 5, 9),
                responsible="Talita Gonçalves",
                areas=[
                    SeedArea(
                        "Unidade 01 – Lapa",
                        6.2,
                        RestorationStatus.active,
                        goal="Implantar 6,2 ha de sistema agroflorestal em Lapa.",
                    ),
                    SeedArea(
                        "Unidade 02 – Palmeira",
                        5.8,
                        RestorationStatus.active,
                        goal="Implantar 5,8 ha de sistema agroflorestal em Palmeira.",
                    ),
                    SeedArea(
                        "Unidade 03 – São Mateus do Sul",
                        7.0,
                        RestorationStatus.planned,
                        goal="Implantar 7 ha de sistema agroflorestal em São Mateus do Sul.",
                    ),
                ],
            ),
        ],
    ),
]


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    payload = chunk_type + data
    return (
        struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)
    )


def _make_placeholder_png(width: int, height: int) -> bytes:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        red = int(36 * (1 - y / height))
        green = int(60 + 150 * (y / height))
        blue = int(48 * (1 - y / height))
        raw.extend(bytes((red, green, blue)) * width)
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", header)
        + _png_chunk(b"IDAT", zlib.compress(bytes(raw), level=9))
        + _png_chunk(b"IEND", b"")
    )


def _placeholder_png() -> bytes:
    global _PLACEHOLDER_PNG_CACHE
    if _PLACEHOLDER_PNG_CACHE is None:
        _PLACEHOLDER_PNG_CACHE = _make_placeholder_png(_PLACEHOLDER_WIDTH, _PLACEHOLDER_HEIGHT)
    return _PLACEHOLDER_PNG_CACHE


def _species_data(rng: random.Random, total: int, pool: list[tuple[str, str]]) -> dict[str, object]:
    chosen = rng.sample(pool, k=rng.randint(2, min(4, len(pool))))
    weights = [rng.uniform(0.3, 1.0) for _ in chosen]
    total_weight = sum(weights)
    counts = [int(total * weight / total_weight) for weight in weights]
    counts[-1] = total - sum(counts[:-1])
    species: list[dict[str, object]] = [
        {"name": name, "count": count} for (name, _), count in zip(chosen, counts)
    ]
    return {"species": species}


def _photo_names(rng: random.Random, visit_date: date) -> list[str]:
    count = rng.randint(1, 3)
    stamp = visit_date.strftime("%Y%m%d")
    return [f"registro_{stamp}_{index:02d}.png" for index in range(count)]


def _build_visits(
    rng: random.Random,
    area: SeedArea,
    start_date: date,
    today: date,
    biome: str,
) -> list[_VisitPlan]:
    if area.status == RestorationStatus.cancelled:
        return []

    if area.status == RestorationStatus.planned:
        recon = start_date + timedelta(days=rng.randint(10, 40))
        if recon > today:
            return []
        return [
            _VisitPlan(
                visit_date=recon,
                seedling_count=None,
                avg_height=None,
                species_data=None,
                notes="Visita de reconhecimento para delimitação e georreferenciamento da área.",
                photo_names=[],
            )
        ]

    end = today
    if area.status == RestorationStatus.completed:
        end = start_date + timedelta(days=rng.randint(540, 760))
        if end > today:
            end = today

    planted = int(area.size_hectares * rng.uniform(1000, 1800))
    alive = int(planted * rng.uniform(0.85, 0.92))
    visits: list[_VisitPlan] = []
    current = start_date
    step = 0
    while current <= end:
        if step > 0:
            alive = max(1, int(alive * rng.uniform(0.96, 0.995)))
            if rng.random() < 0.12:
                replant = int(planted * rng.uniform(0.02, 0.06))
                alive = min(int(planted * 1.05), alive + replant)
        height = round(min(0.25 + step * rng.uniform(0.05, 0.12), 3.5), 2)
        species_data = _species_data(rng, alive, _SPECIES_BY_BIOME[biome])
        notes = rng.choice(_NOTES)
        visits.append(
            _VisitPlan(
                visit_date=current,
                seedling_count=alive,
                avg_height=height,
                species_data=species_data,
                notes=notes,
                photo_names=_photo_names(rng, current),
            )
        )
        current += timedelta(days=rng.randint(45, 100))
        step += 1
    return visits


def _area_geometry(lat: float, lng: float, rng: random.Random) -> dict[str, object]:
    delta = rng.uniform(0.003, 0.008)
    ring = [
        (round(lng - delta, 6), round(lat - delta, 6)),
        (round(lng + delta, 6), round(lat - delta, 6)),
        (round(lng + delta, 6), round(lat + delta, 6)),
        (round(lng - delta, 6), round(lat + delta, 6)),
        (round(lng - delta, 6), round(lat - delta, 6)),
    ]
    return {"type": "Polygon", "coordinates": [ring]}


def _build_plan(rng: random.Random, today: date) -> list[_OrganizationPlan]:
    plan: list[_OrganizationPlan] = []
    for organization in _ORGANIZATIONS:
        project_plans: list[_ProjectPlan] = []
        for project in organization.projects:
            area_plans: list[_AreaPlan] = []
            base_lat, base_lng = organization.coords
            for area in project.areas:
                lat = base_lat + rng.uniform(-0.3, 0.3)
                lng = base_lng + rng.uniform(-0.3, 0.3)
                geometry = _area_geometry(lat, lng, rng)
                visits = _build_visits(rng, area, project.start_date, today, organization.biome)
                area_plans.append(_AreaPlan(area=area, geometry=geometry, visits=visits))
            project_plans.append(_ProjectPlan(project=project, areas=area_plans))
        plan.append(_OrganizationPlan(organization=organization, projects=project_plans))
    return plan


def _write_photo_file(monitoring_id: UUID, original_filename: str) -> tuple[str, int]:
    png_bytes = _placeholder_png()
    key = save_upload(png_bytes, original_filename, "image/png", monitoring_id)
    return key, len(png_bytes)


def seed(
    session: Session,
    *,
    create_photos: bool = True,
    password: str = DEFAULT_PASSWORD,
) -> SeedReport:
    report = SeedReport()
    rng = random.Random(42)
    plan = _build_plan(rng, date.today())

    existing_emails = set(session.exec(select(User.email)).all())
    existing_memberships = {
        (membership.user_id, membership.organization_id)
        for membership in session.exec(select(UserOrganization)).all()
    }
    existing_photos = set(session.exec(select(Photo.monitoring_id)).all())

    if SUPERUSER_EMAIL not in existing_emails:
        session.add(
            User(
                name="Administrador OpenForest",
                email=SUPERUSER_EMAIL,
                password_hash=hash_password(password),
                is_superuser=True,
            )
        )
        existing_emails.add(SUPERUSER_EMAIL)
        report.users_created += 1
    else:
        report.users_skipped += 1

    for org_plan in plan:
        organization = session.exec(
            select(Organization).where(Organization.slug == org_plan.organization.slug)
        ).first()
        if organization is None:
            organization = Organization(
                name=org_plan.organization.name,
                slug=org_plan.organization.slug,
                description=org_plan.organization.description,
            )
            session.add(organization)
            report.organizations_created += 1
        else:
            report.organizations_skipped += 1

        for user_def in org_plan.organization.users:
            user = session.exec(select(User).where(User.email == user_def.email)).first()
            if user is None:
                user = User(
                    name=user_def.name,
                    email=user_def.email,
                    password_hash=hash_password(password),
                )
                session.add(user)
                existing_emails.add(user_def.email)
                report.users_created += 1
            else:
                report.users_skipped += 1

            if (user.id, organization.id) not in existing_memberships:
                session.add(
                    UserOrganization(
                        user_id=user.id,
                        organization_id=organization.id,
                        role=user_def.role,
                    )
                )
                existing_memberships.add((user.id, organization.id))
                report.memberships_created += 1
            else:
                report.memberships_skipped += 1

            if organization.created_by is None and user_def.role == UserOrganizationRole.manager:
                session.flush()
                organization.created_by = user.id

        for project_plan in org_plan.projects:
            project = session.exec(
                select(Project).where(
                    Project.organization_id == organization.id,
                    Project.name == project_plan.project.name,
                )
            ).first()
            if project is None:
                project = Project(
                    organization_id=organization.id,
                    name=project_plan.project.name,
                    description=project_plan.project.description,
                    goal=project_plan.project.goal,
                    start_date=project_plan.project.start_date,
                    responsible=project_plan.project.responsible,
                    created_by=organization.created_by,
                )
                session.add(project)
                report.projects_created += 1
            else:
                report.projects_skipped += 1

            for area_plan in project_plan.areas:
                area = session.exec(
                    select(Area).where(
                        Area.project_id == project.id,
                        Area.name == area_plan.area.name,
                    )
                ).first()
                if area is None:
                    area = Area(
                        project_id=project.id,
                        name=area_plan.area.name,
                        goal=area_plan.area.goal,
                        size_hectares=area_plan.area.size_hectares,
                        biome=org_plan.organization.biome,
                        geometry=to_geometry(area_plan.geometry),
                        restoration_status=area_plan.area.status,
                    )
                    session.add(area)
                    report.areas_created += 1
                else:
                    report.areas_skipped += 1

                for visit in area_plan.visits:
                    monitoring = session.exec(
                        select(Monitoring).where(
                            Monitoring.area_id == area.id,
                            Monitoring.visit_date == visit.visit_date,
                        )
                    ).first()
                    if monitoring is None:
                        monitoring = Monitoring(
                            area_id=area.id,
                            visit_date=visit.visit_date,
                            notes=visit.notes,
                            seedling_count=visit.seedling_count,
                            avg_height=visit.avg_height,
                            species_data=visit.species_data,
                        )
                        session.add(monitoring)
                        report.monitorings_created += 1
                    else:
                        report.monitorings_skipped += 1

                    if not create_photos:
                        continue
                    if monitoring.id in existing_photos:
                        report.photos_skipped += 1
                        continue
                    for original_filename in visit.photo_names:
                        file_path, file_size = _write_photo_file(monitoring.id, original_filename)
                        session.add(
                            Photo(
                                monitoring_id=monitoring.id,
                                file_path=file_path,
                                original_filename=original_filename,
                                mime_type="image/png",
                                file_size=file_size,
                                width=_PLACEHOLDER_WIDTH,
                                height=_PLACEHOLDER_HEIGHT,
                            )
                        )
                        report.photos_created += 1
                    existing_photos.add(monitoring.id)

    return report


def reset(session: Session) -> None:
    session.execute(text(f"TRUNCATE TABLE {', '.join(_TABLE_NAMES)} CASCADE"))
    session.commit()
    if settings.storage_backend == "s3":
        delete_photo_prefix("photos/")
    else:
        _clear_local_photos()


def _clear_local_photos() -> None:
    root = Path(settings.storage_path) / "photos"
    if root.exists():
        for path in root.rglob("*"):
            if path.is_file():
                path.unlink()


def _format_report(report: SeedReport, password: str, verbose: bool) -> str:
    lines = [
        "Seed concluído.",
        f"  Organizações: {report.organizations_created} criadas ({report.organizations_skipped} já existentes)",
        f"  Usuários: {report.users_created} criados ({report.users_skipped} já existentes)",
        f"  Vínculos: {report.memberships_created} criados ({report.memberships_skipped} já existentes)",
        f"  Projetos: {report.projects_created} criados ({report.projects_skipped} já existentes)",
        f"  Áreas: {report.areas_created} criadas ({report.areas_skipped} já existentes)",
        f"  Monitoramentos: {report.monitorings_created} criados ({report.monitorings_skipped} já existentes)",
        f"  Fotos: {report.photos_created} criadas ({report.photos_skipped} já existentes)",
        "",
        "Credenciais:",
        f"  Admin: {SUPERUSER_EMAIL} / {password}",
        f"  Demais usuários: senha comum '{password}'",
    ]
    if verbose:
        for organization in _ORGANIZATIONS:
            managers = ", ".join(
                f"{user.email} ({user.role.value})"
                for user in organization.users
                if user.role == UserOrganizationRole.manager
            )
            lines.append(f"  {organization.name} — {managers}")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Popula o banco de desenvolvimento com dados realistas de organizações, "
            "usuários, projetos, áreas, monitoramentos e fotos."
        )
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Apaga os dados existentes antes de semear.",
    )
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help=f"Senha comum usada para os usuários criados (padrão: '{DEFAULT_PASSWORD}').",
    )
    parser.add_argument(
        "--no-photos",
        action="store_true",
        help="Não cria registros nem arquivos de foto.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Lista os gestores de cada organização ao final.",
    )
    args = parser.parse_args()

    with Session(engine) as session:
        if args.reset:
            reset(session)
        report = seed(
            session,
            create_photos=not args.no_photos,
            password=args.password,
        )
        session.commit()

    print(_format_report(report, password=args.password, verbose=args.verbose))
