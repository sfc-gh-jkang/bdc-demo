-- =============================================================================
-- DEPRECATED: 02-pg-lake.sql
-- =============================================================================
-- This file is no longer used. The demo now uses Snowflake-managed Iceberg
-- tables (CATALOG='SNOWFLAKE') with data stored in Snowflake's own managed
-- storage. No Postgres, pg_lake, S3, or external volume is needed.
--
-- Iceberg tables are created in: dcm/pre_deploy.sql
-- Daily data generation:         sql/04-daily-task.sql
--
-- Kept for historical reference only.
-- =============================================================================
--
-- ORIGINAL DESCRIPTION:
-- pg_lake setup: replicate Postgres tables to Iceberg on S3
--
-- IMPORTANT: Commands in this file target TWO different systems.
--   [SNOWFLAKE] = Run in Snowflake (Snowsight, snowsql, or Cortex Code)
--   [POSTGRES]  = Run via psql against the BDC_PG instance
--                 (psql service=bdc_pg)
--
-- Run order: Sections 1-2 in Snowflake, then 3-5 in Postgres, then 6 in Snowflake.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Snowflake Storage Integration
-- [SNOWFLAKE]
-- =============================================================================

-- NOTE: Use TYPE = EXTERNAL_STAGE (not POSTGRES_EXTERNAL_STORAGE — deprecated)
CREATE STORAGE INTEGRATION IF NOT EXISTS BDC_PG_LAKE_INT
    TYPE = EXTERNAL_STAGE
    STORAGE_PROVIDER = 'S3'
    STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<ACCOUNT_ID>:role/bdc-pg-lake-role'
    STORAGE_ALLOWED_LOCATIONS = ('s3://bdc-pg-lake-demo/')
    ENABLED = TRUE;

-- Retrieve IAM trust policy values needed for the AWS role trust relationship.
-- After running this, note STORAGE_AWS_IAM_USER_ARN and STORAGE_AWS_EXTERNAL_ID.
-- Add these to the trust policy of the bdc-pg-lake-role IAM role (see IAM note below).
DESC INTEGRATION BDC_PG_LAKE_INT;

-- IAM TRUST POLICY NOTE:
-- The bdc-pg-lake-role IAM role must trust the Snowflake IAM user from DESC above.
-- Minimal trust policy:
--
-- {
--   "Version": "2012-10-17",
--   "Statement": [{
--     "Effect": "Allow",
--     "Principal": { "AWS": "<STORAGE_AWS_IAM_USER_ARN>" },
--     "Action": "sts:AssumeRole",
--     "Condition": {
--       "StringEquals": { "sts:ExternalId": "<STORAGE_AWS_EXTERNAL_ID>" }
--     }
--   }]
-- }
--
-- IMPORTANT: Set max session duration on the IAM role to 12 hours (43200 seconds).
-- pg_lake refreshes credentials on that schedule. If the max session duration is
-- shorter (e.g. the AWS default of 1 hour), pg_lake will fail silently when the
-- token expires mid-run.


-- =============================================================================
-- SECTION 2: Attach Storage Integration to Postgres Instance
-- [SNOWFLAKE]
-- =============================================================================

ALTER DATABASE BDC_PG SET STORAGE_INTEGRATION = BDC_PG_LAKE_INT;


-- =============================================================================
-- SECTION 3: Enable pg_lake in Postgres
-- [POSTGRES] psql service=bdc_pg
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_lake;

-- Set the S3 prefix where pg_lake will write Iceberg data.
-- All tables will be nested under this prefix (e.g. s3://bdc-pg-lake-demo/bdc_pg/calls/).
SELECT pg_lake.set_s3_prefix('s3://bdc-pg-lake-demo/bdc_pg/');


-- =============================================================================
-- SECTION 4: Iceberg-backed Tables in Postgres
-- [POSTGRES] psql service=bdc_pg
--
-- These mirror the source table schemas but write Parquet files to S3.
-- The LIKE clause copies column definitions; add any missing columns manually
-- if the source tables have constraints or generated columns that don't copy cleanly.
-- =============================================================================

-- Iceberg table for calls
CREATE TABLE IF NOT EXISTS calls_iceberg (
    LIKE calls
) USING iceberg
PARTITION BY (day(call_date));

-- Iceberg table for call transcripts (no partition — typically queried by call_id)
CREATE TABLE IF NOT EXISTS call_transcripts_iceberg (
    LIKE call_transcripts
) USING iceberg;


-- =============================================================================
-- SECTION 5: pg_cron Flush Schedules
-- [POSTGRES] psql service=bdc_pg
--
-- Pattern: INSERT new rows into a *_staging table (from the app), then a cron
-- job drains staging → Iceberg every minute via DELETE ... RETURNING.
-- This avoids duplicate writes and keeps Iceberg files small but fresh.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Flush calls_staging → calls_iceberg every minute
SELECT cron.schedule('flush-calls', '* * * * *', $$
    WITH staged AS (
        DELETE FROM calls_staging RETURNING *
    )
    INSERT INTO calls_iceberg SELECT * FROM staged;
$$);

-- Flush call_transcripts_staging → call_transcripts_iceberg every minute
SELECT cron.schedule('flush-transcripts', '* * * * *', $$
    WITH staged AS (
        DELETE FROM call_transcripts_staging RETURNING *
    )
    INSERT INTO call_transcripts_iceberg SELECT * FROM staged;
$$);

-- Verify schedules registered
-- SELECT * FROM cron.job;


-- =============================================================================
-- SECTION 6: Snowflake External Volume + Iceberg Tables
-- [SNOWFLAKE]
--
-- Snowflake reads the Iceberg metadata written by pg_lake.
-- CATALOG = 'SNOWFLAKE' uses Snowflake-managed catalog (not Glue/Polaris).
-- =============================================================================

-- External volume pointing at the same S3 bucket
CREATE OR REPLACE EXTERNAL VOLUME bdc_pg_lake_vol
    STORAGE_LOCATIONS = (
        (
            NAME            = 'bdc-s3'
            STORAGE_BASE_URL = 's3://bdc-pg-lake-demo/'
            STORAGE_PROVIDER = 'S3'
            STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<ACCOUNT_ID>:role/bdc-pg-lake-role'
        )
    );

-- Iceberg table: calls
-- BASE_LOCATION must match the prefix pg_lake writes for this table.
CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.CALLS_ICEBERG
    CATALOG        = 'SNOWFLAKE'
    EXTERNAL_VOLUME = 'bdc_pg_lake_vol'
    BASE_LOCATION  = 'bdc_pg/calls/'
    COMMENT        = 'Iceberg table from pg_lake — calls';

-- Iceberg table: call_transcripts
CREATE ICEBERG TABLE IF NOT EXISTS BDC_DEMO.RAW.CALL_TRANSCRIPTS_ICEBERG
    CATALOG        = 'SNOWFLAKE'
    EXTERNAL_VOLUME = 'bdc_pg_lake_vol'
    BASE_LOCATION  = 'bdc_pg/call_transcripts/'
    COMMENT        = 'Iceberg table from pg_lake — call_transcripts';


-- =============================================================================
-- SECTION 7: Verification Queries
-- =============================================================================

-- [SNOWFLAKE] Confirm storage integration is active
-- SHOW INTEGRATIONS LIKE 'BDC_PG_LAKE_INT';

-- [SNOWFLAKE] Check external volume is reachable
-- DESCRIBE EXTERNAL VOLUME bdc_pg_lake_vol;

-- [SNOWFLAKE] Spot-check row counts after first flush cycle
-- SELECT COUNT(*) FROM BDC_DEMO.RAW.CALLS_ICEBERG;
-- SELECT COUNT(*) FROM BDC_DEMO.RAW.CALL_TRANSCRIPTS_ICEBERG;

-- [POSTGRES] Confirm pg_cron jobs are registered
-- SELECT jobid, schedule, command, active FROM cron.job;

-- [POSTGRES] Confirm pg_lake prefix
-- SELECT pg_lake.get_s3_prefix();

-- [POSTGRES] Check staging tables are draining (run after a flush cycle)
-- SELECT COUNT(*) FROM calls_staging;
-- SELECT COUNT(*) FROM call_transcripts_staging;
