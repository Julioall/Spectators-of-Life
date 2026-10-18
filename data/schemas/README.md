# Contratos de dados planejados

Os schemas ainda serão implementados com fixtures válidas e inválidas. Não são funcionalidades prontas.

| Fase | Contratos |
| --- | --- |
| F0 | world, scenario, save, module-manifest, asset-manifest, event |
| F1 | terrain, climate, water-reservoir, water-flux, soil |
| F2 | plant-profile, vegetation, detritus, decomposition |
| F3 | species, organism, metabolism, health, reproduction, population |
| F4 | observation, action, brain, genome, lineage, learning-experiment |
| F5–F6 | human-capabilities, relationships, culture, tribe |
| F7–F9 | skills, profession, settlement, economy, institution, polity |

Organismos naturais não exigem cérebro, profissão ou afiliação política. Plantas e decompositores agregados possuem representação declarada. Genoma, pesos e cultura têm contratos distintos.

Cada schema declara versão, unidades, limites, defaults, referências e migrações. Conteúdo não confiável passa por validação; incompatibilidade de save é diagnosticada antes de alterar o original. Estoques e fluxos possuem unidades compatíveis e campos explícitos para fontes/perdas.
