# Contratos de dados

Os contratos F0 possuem schemas JSON versionados, validação de runtime e fixtures em `data/fixtures/spec-000/`. A cobertura executável não significa que o gate F0 está aprovado nem que existem sistemas ecológicos.

| Arquivo | Contrato |
| --- | --- |
| [worker-protocol.v1.schema.json](worker-protocol.v1.schema.json) | Mensagens Worker v1: pedidos e respostas |
| [save.v1.schema.json](save.v1.schema.json) | Documento de save v1 |

O Worker aplica também limites em bytes e invariantes que não cabem no schema JSON, como ordenação e unicidade de IDs. Limites atuais: pedido/resposta 4 MiB; snapshot/save 3 MiB; estado lógico 3 MiB menos 1 KiB, reservando espaço para metadados do save; 256 fluxos RNG e módulos ativos; 1.024 agendas; 100.000 entidades; até 4.096 eventos na resposta. Eventos excedentes são contados em `eventsOmitted` sem alterar a simulação. Veja [SPEC-000](../../docs/specs/000-fundacao-runtime.md) para o contrato completo.

| Fase | Contratos |
| --- | --- |
| F0 | world, scenario, save, worker-request, worker-response, module-manifest, asset-manifest, event |
| F1 | terrain, climate, water-reservoir, water-flux, soil |
| F2 | plant-profile, vegetation, detritus, decomposition |
| F3 | species, organism, metabolism, health, reproduction, population, observation, action, heuristic-controller |
| F4 | versões neurais de observation/action, brain, genome, lineage, learning-experiment |
| F5–F6 | human-capabilities, relationships, culture, tribe |
| F7–F9 | skills, profession, settlement, economy, institution, polity |

Organismos naturais não exigem cérebro, profissão ou afiliação política. Plantas e decompositores agregados possuem representação declarada. Genoma, pesos e cultura têm contratos distintos.

Cada schema declara versão, unidades, limites, defaults, referências e migrações. Conteúdo não confiável passa por validação; incompatibilidade de save é diagnosticada antes de alterar o original. Estoques e fluxos possuem unidades compatíveis e campos explícitos para fontes/perdas.
