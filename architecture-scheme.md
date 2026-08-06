# OpenForest Architecture Scheme

> Target-state architecture of the final product.
>
> Status: Living Document
>
> This document is a scheme (diagram-centric overview). For prose details, see `ARCHITECTURE.md`; for the evolution path, see `ROADMAP.md`.

---

## 1. System Overview

```mermaid
flowchart TB
    subgraph Clients["Clients"]
        Web["Web / Next.js App"]
        Mobile["Mobile / PWA"]
        PublicAPI["Public API Consumers / SDK"]
    end

    subgraph Edge["Edge"]
        CDN["CDN / WAF"]
        LB["Load Balancer / API Gateway"]
    end

    subgraph App["Application Layer"]
        API["FastAPI Modular Monolith<br/>(projects · areas · monitoring · species · media · auth)"]
        Workers["Background Workers<br/>(thumbnails · exports · notifications)"]
    end

    subgraph Messaging["Messaging"]
        Kafka["Kafka<br/>(domain-events · sensor-ingest · analytics)"]
        MQTT["MQTT Broker<br/>(IoT / field sensors)"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL Primary"]
        PGReplica["PostgreSQL Read Replica"]
        Redis["Redis"]
        MinIO["MinIO / S3-compatible Object Storage"]
    end

    subgraph External["External Integrations"]
        GBIF["GBIF (species taxonomy)"]
        INat["iNaturalist (species)"]
        Weather["Weather APIs"]
        GIS["GIS (QGIS / ArcGIS)"]
        Gov["Government Systems"]
        AI["AI Providers<br/>(reports · semantic search)"]
    end

    subgraph Observability["Observability Stack"]
        OTel["OpenTelemetry Collector"]
        Prom["Prometheus"]
        Loki["Loki"]
        Tempo["Tempo"]
        Grafana["Grafana"]
        Sentry["Sentry / Error Tracking"]
    end

    Web --> CDN
    Mobile --> CDN
    PublicAPI --> CDN
    CDN --> LB
    LB --> API

    API --> PG
    API --> PGReplica
    API --> Redis
    API --> MinIO

    API -->|publish| Kafka
    Workers -->|publish| Kafka
    Workers <-->|consume| Kafka
    API <-->|consume| Kafka

    MQTT -->|sensor events| Kafka

    API --> GBIF
    API --> INat
    API --> Weather
    API <--> GIS
    API --> Gov
    API --> AI

    API -.-> OTel
    Workers -.-> OTel
    Kafka -.-> OTel
    PG -.-> OTel
    PGReplica -.-> OTel
    Redis -.-> OTel
    MinIO -.-> OTel

    OTel --> Prom
    OTel --> Loki
    OTel --> Tempo
    Prom --> Grafana
    Loki --> Grafana
    Tempo --> Grafana
    API -.-> Sentry
    Workers -.-> Sentry
```

---

## 2. Detailed Diagrams

### 2.1 Data Layer

```mermaid
flowchart LR
    subgraph API["Application"]
        RW["Write Path (API)"]
        RD["Read Path (API)"]
        CACHE["Cache-Aside Layer"]
        STORE["Upload/Download Service"]
    end

    subgraph DB["PostgreSQL Cluster"]
        PGP["Primary (read/write)"]
        PGR["Read Replica (read-only)"]
        STREAM["Streaming Replication"]
    end

    subgraph Cache["Redis"]
        RC["Response / Query Cache"]
        RL["Rate Limiting"]
        SESS["Sessions / Tokens"]
        LOCK["Distributed Locks"]
        PUBSUB["Pub/Sub"]
    end

    subgraph Obj["Object Storage"]
        B1["Bucket: photos"]
        B2["Bucket: exports"]
        B3["Bucket: reports"]
    end

    RW -->|INSERT / UPDATE / DELETE| PGP
    PGP -->|WAL streaming| STREAM
    STREAM --> PGR
    RD -->|"SELECT - analytics / dashboards"| PGR
    RD -->|hot reads| CACHE
    CACHE --> RC
    CACHE --> RL
    CACHE --> SESS
    CACHE --> LOCK
    STORE -->|presigned upload| B1
    STORE -->|generate| B2
    STORE -->|generate| B3
    PUBSUB -.->|cache invalidation events| RC
```

### 2.2 Event-Driven / Messaging

```mermaid
flowchart TB
    subgraph Producers
        APIEV["API (domain events)"]
        WKEV["Workers (job results)"]
        MQTTS["MQTT Bridge (sensor data)"]
    end

    subgraph KafkaCluster["Kafka Cluster"]
        T1["topic: domain-events"]
        T2["topic: sensor-ingest"]
        T3["topic: analytics"]
        T4["topic: notifications"]
        DLQ["DLQ: dead-letter"]
    end

    subgraph Consumers
        W1["Consumers: notifications worker"]
        W2["Consumers: analytics worker"]
        W3["Consumers: search indexer"]
        W4["Consumers: webhook dispatcher"]
    end

    subgraph Sinks
        EmailPush["Email / Push"]
        Analytics["Aggregates / Analytics DB"]
        Search["Search Index"]
        Webhook["Webhooks"]
    end

    APIEV --> T1
    WKEV --> T1
    MQTTS --> T2
    T1 --> W1
    T1 --> W3
    T1 --> W4
    T2 --> W2
    W1 --> EmailPush
    W2 --> Analytics
    W3 --> Search
    W4 --> Webhook
    W1 -.->|retry exhausted| DLQ
    W2 -.->|retry exhausted| DLQ
    W3 -.->|retry exhausted| DLQ
    W4 -.->|retry exhausted| DLQ
```

### 2.3 External Integrations

```mermaid
flowchart LR
    subgraph App["Application"]
        ImportSvc["Import / Enrichment Service"]
        ExportSvc["Export Service"]
        NotifySvc["Notification / Webhook Service"]
    end

    subgraph Inbound
        GBIF["GBIF API"]
        INat["iNaturalist API"]
        Weather["Weather APIs"]
        GovIn["Government Systems (pull)"]
    end

    subgraph Outbound
        GIS["QGIS / ArcGIS (layers)"]
        GovOut["Government Systems (push)"]
        WebhookOut["External Webhooks"]
    end

    ImportSvc -->|species taxonomy| GBIF
    ImportSvc -->|species observations| INat
    ImportSvc -->|climate history| Weather
    ImportSvc -->|regulatory data| GovIn
    ExportSvc -->|GeoJSON / KML| GIS
    NotifySvc -->|compliance reports| GovOut
    NotifySvc -->|event notifications| WebhookOut
```

### 2.4 Observability Stack

```mermaid
flowchart LR
    subgraph Sources["Instrumented Components"]
        S1["FastAPI (OTel SDK)"]
        S2["Workers (OTel SDK)"]
        S3["Kafka / MQTT"]
        S4["PostgreSQL / Redis / MinIO"]
    end

    subgraph Collector["OpenTelemetry Collector"]
        RCV["OTLP receiver"]
        PROC["Processors (batching, sampling)"]
        EXP["Exporters"]
    end

    subgraph Backends["Backends"]
        Prom["Prometheus (metrics)"]
        Loki["Loki (logs)"]
        Tempo["Tempo (traces)"]
    end

    subgraph Viz["Visualization"]
        Grafana["Grafana Dashboards"]
        Alert["Alerting / SLOs"]
    end

    S1 -->|OTLP| RCV
    S2 -->|OTLP| RCV
    S3 -->|OTLP| RCV
    S4 -->|exporters| RCV
    RCV --> PROC --> EXP
    EXP -->|metrics| Prom
    EXP -->|logs| Loki
    EXP -->|traces| Tempo
    Prom --> Grafana
    Loki --> Grafana
    Tempo --> Grafana
    Prom --> Alert
```

### 2.5 Photo Upload Flow

```mermaid
sequenceDiagram
    participant Client as Web / Mobile
    participant API as FastAPI API
    participant Redis as Redis
    participant MinIO as MinIO / S3
    participant PG as PostgreSQL Primary
    participant Kafka as Kafka
    participant Worker as Image Worker

    Client->>API: POST /v1/monitoring/.../photos (multipart)
    API->>MinIO: presigned upload URL
    API-->>Client: { upload_url, photo_id }
    Client->>MinIO: PUT object (presigned)
    MinIO-->>Client: 200 OK
    Client->>API: confirm upload
    API->>PG: insert photo metadata
    API->>Redis: invalidate cache key
    API->>Kafka: publish photo.uploaded (domain-event)
    Kafka-->>Worker: consume photo.uploaded
    Worker->>MinIO: generate thumbnail
    Worker->>PG: update thumbnail metadata
```

---

## 3. Data & Event Flow Notes

- **Write path:** API writes to PostgreSQL Primary only; all mutations go through FastAPI.
- **Read path:** Dashboards and hot reads hit the PostgreSQL Read Replica; hot queries are served from the Redis cache (cache-aside). Cache is never the source of truth.
- **Upload flow:** Objects go directly to MinIO via presigned URLs; metadata lands in PostgreSQL; events trigger background thumbnail generation.
- **Event flow:** Domain events are published to Kafka by the API and workers; consumers handle notifications, analytics aggregation, search indexing, and webhook dispatch. Failed messages go to a dead-letter topic after retries.
- **Sensor flow:** IoT/field devices publish over MQTT; the MQTT bridge writes to the Kafka `sensor-ingest` topic for durable, replayable processing.
- **Observability:** Every component emits OpenTelemetry (metrics, logs, traces) via the collector; Prometheus, Loki, and Tempo are the backends; Grafana is the single view; Sentry captures errors.

---

## 4. Legend / Conventions

- **Solid arrow (`-->`)** — synchronous call or data transfer.
- **Dashed arrow (`-.->`)** — asynchronous, telemetry, or control signal.
- **Double-headed arrow (`<-->`)** — bidirectional relationship (e.g., consume/publish, push/pull).
- **Subgraphs** group components by concern: clients, edge, application, messaging, data, external, observability.
- The **overview diagram** (section 1) is the high-level container map; the **detailed diagrams** (section 2) zoom into each area.
