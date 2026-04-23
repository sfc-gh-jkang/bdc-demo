-- =============================================================================
-- Infrastructure: Schemas, Warehouse, Internal Stage
-- =============================================================================
-- Parent database BDC_DEMO is created in pre_deploy.sql (DCM constraint:
-- cannot DEFINE its own parent database).
-- =============================================================================

-- Schemas
DEFINE SCHEMA BDC_DEMO.RAW
    COMMENT = 'Landing zone — Iceberg tables from pg_lake';

DEFINE SCHEMA BDC_DEMO.ANALYTICS
    COMMENT = 'Dynamic tables with Cortex AI enrichment';

DEFINE SCHEMA BDC_DEMO.COACHING
    COMMENT = 'Serving layer — Interactive Tables and app views';

-- Standard warehouse for dynamic table refreshes and data loading
DEFINE WAREHOUSE BDC_STD_WH
WITH
    WAREHOUSE_SIZE = 'XSMALL'
    AUTO_SUSPEND = 120
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    COMMENT = 'Compute for dynamic table refreshes and data loading';

-- Internal stage for CSV/Parquet loading
DEFINE STAGE BDC_DEMO.RAW.BDC_DATA_STAGE
    COMMENT = 'Internal stage for loading seed data files';
