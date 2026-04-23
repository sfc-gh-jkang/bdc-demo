# Security Policy

## Supported Versions

This is a Snowflake demonstration project, not a production-supported product. There are no versioned releases; the `main` branch is the only supported reference.

## Reporting a Vulnerability

If you discover a security issue in this demo's code (hard-coded secrets, injection vectors, insecure deployment patterns, exposed credentials, etc.), please **do not** open a public GitHub issue.

Instead, email **john.kang@snowflake.com** with:

- A description of the issue
- Steps to reproduce
- The commit SHA you observed it on
- Any suggested remediation

You will receive an acknowledgement within 5 business days.

## Scope

This repository is a **demo / reference implementation**. It is intended to be deployed into your own Snowflake account for internal demonstration purposes only. It is **not** intended to be run against production customer data, Snowflake's internal systems, or any environment containing real PII.

All sample data in `data/` is synthetically generated. No real customer, employee, or call-recording data is included.

## Out of Scope

- Issues in upstream dependencies (React, FastAPI, Snowflake CLI, Cortex). Report those to the respective projects.
- Configuration choices made by a user who deploys this demo into their own account.
- Vulnerabilities in Snowflake platform features themselves — report those through Snowflake's product security channel.

## Maintainer

John Kang · john.kang@snowflake.com · [@sfc-gh-jkang](https://github.com/sfc-gh-jkang)
