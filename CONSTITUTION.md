# BDC Agent Coaching Demo — Constitution

## Core Principles

### I. BDC-Realistic Data
All synthetic data must reflect real automotive BDC operational patterns. Call volumes follow time-of-day curves (peak 9-11am, 2-4pm). Disposition codes match industry benchmarks: 25% status checks, 37% advisor connection failure, 30% appointment show rate. Agent performance follows a power-law distribution: top 20% drive 50% of appointments. Call transcripts must use BDC-specific language patterns ("connecting you to your service advisor", "I see your 2022 Civic is due for its 30K service").

### II. End-to-End Pipeline
Every layer from Postgres write to React read must be independently demonstrable. The demo must show data flowing through each stage: Postgres (operational writes) → pg_lake (Iceberg materialization) → Snowflake Iceberg (zero-ETL read) → Dynamic Tables (Cortex AI enrichment) → Interactive Tables (sub-second serving) → FastAPI (API layer) → React (user interface). Each stage must be queryable and verifiable in isolation.

### III. Snowflake-Native
Use Snowflake features exclusively. No external ETL tools, no external AI APIs, no third-party data services. Cortex AI functions (AI_SENTIMENT, AI_SUMMARIZE, AI_CLASSIFY, AI_EXTRACT) run natively in Snowflake. Interactive Tables and Interactive Warehouses serve the application layer. SPCS hosts the application. Observe monitors the service. The only external dependency is AWS S3 for Iceberg storage (required by pg_lake).

### IV. Demo-Ready
Single deploy script. Idempotent setup — running setup twice must not fail or corrupt data. Works without access to actual production systems. All synthetic data is self-contained. The demo must be presentable within 2 minutes of deployment completing. Teardown script must cleanly remove all resources.

## Technology Stack

| Layer | Technology | Version/Size |
|-------|-----------|--------------|
| Operational DB | Snowflake Postgres | STANDARD_M |
| Data Lake | pg_lake (Iceberg on S3) | Parquet, day-partitioned |
| Analytics | Snowflake Iceberg Tables | CATALOG_SOURCE = OBJECT_STORE |
| AI Enrichment | Dynamic Tables + Cortex AI | TARGET_LAG = DOWNSTREAM |
| Serving | Interactive Tables | CLUSTER BY per query pattern |
| Compute (serving) | Interactive Warehouse | XSMALL |
| Backend | Python FastAPI | 3.11+ |
| Frontend | Vite + React 19 | TailwindCSS 4, Radix UI, Recharts |
| Deployment | SPCS | 3 containers + observe-agent |
| Monitoring | Observe | O4S + OTel dashboards |

## Data Scale

| Dimension | Value |
|-----------|-------|
| Dealers | 5 |
| Agents | 30 (6 per dealer) |
| Customers | 2,000 |
| Vehicles | 2,500 |
| Calls (30 days) | 15,000 |
| Call Transcripts | 15,000 |
| Text Messages | 5,000 |
| Email Logs | 3,000 |

## Governance

This constitution supersedes all other development decisions. All code must trace back to the specification in `specs/agent-coaching/spec.md`. Changes to the specification require updating the constitution if they conflict with these principles.

**Version**: 1.0 | **Ratified**: 2026-03-31
