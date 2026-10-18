# Skills de desenvolvimento por IA

As skills do projeto ficam em `.agents/skills/<nome>/SKILL.md`, seguindo o formato aberto Agent Skills. O Codex pode descobrir skills locais do repositório; outras ferramentas compatíveis podem consumir o mesmo formato conforme sua configuração.

| Skill | Quando usar | Fase principal |
| --- | --- | --- |
| `natural-world-systems` | terreno, clima, água, solo, plantas e decomposição | F1–F2 |
| `animal-biology-evolution` | fauna, ciclo de vida, redes online, mutação e herança | F3–F4 |
| `deterministic-simulation-validation` | cenários, testes, RNG, saves e gates | F0–F9 |
| `procedural-pixel-art` | arte pixel art feita em código e integração de assets | F1–F9 |
| `world-observation-ui` | mapa Phaser, câmera, painéis e inspeção | F0–F9 |
| `human-societies-progression` | humanos, tribos, aldeias, profissões, Estados e impérios | F5–F9 |

Use uma skill quando o pedido corresponder ao seu gatilho; combine apenas as necessárias. `AGENTS.md` contém regras permanentes; as skills trazem procedimentos específicos. As instruções explícitas do usuário prevalecem.

## Exemplos de roteamento

- “Faça chover e atualize a umidade do solo” → `natural-world-systems` e `deterministic-simulation-validation`.
- “Ajuste como o lobo aprende a caçar” → `animal-biology-evolution` e `deterministic-simulation-validation`.
- “Desenhe uma samambaia em pixel art procedural” → `procedural-pixel-art`.
- “Mostre a umidade em uma camada do mapa” → `world-observation-ui`.
- “Planeje a formação de pequenas tribos” → `human-societies-progression`; se o gate natural não estiver aprovado, manter como planejamento.

## Manutenção

Skills são instruções, não prova de que uma funcionalidade exista. Atualize gatilhos quando fases ou contratos mudarem. Mantenha o frontmatter curto, procedimentos focados e referências apontadas para documentos canônicos.