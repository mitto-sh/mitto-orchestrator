# mitto-orchestrator

Deployment Orchestrator — manages the full deploy lifecycle via Terraform Cloud.

## Responsibilities
- Create/update Terraform Cloud workspaces per project service
- Trigger terraform runs via TF Cloud REST API
- Poll run status and update deployment records
- Support self-hosted mode (Docker Engine / Swarm / K8s API)

## Deploy Modes
| Mode | Provisioner |
|------|-------------|
| aws-terraform | Terraform Cloud (HCP Terraform) |
| docker | Docker Engine API |
| swarm | Docker Swarm API |
| kubernetes | Kubernetes API |

## Stack
> TBD

## Getting Started
```bash
cp .env.example .env
docker compose up
```
