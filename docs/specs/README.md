# Especificações de implementação

Este diretório transforma a visão e os contratos de domínio em requisitos verificáveis para cada fase. Os documentos canônicos continuam sendo a referência de produto e escopo: [roadmap](../09-roadmap.md), [simulação](../02-simulacao-spec.md), [indivíduo e IA](../03-individual-ai-spec.md), [arquitetura](../04-arquitetura-e-integracao.md) e [mundo natural](../10-ecologia-e-biologia.md).

## Estado

| ID | Especificação | Fase | Estado |
| --- | --- | --- | --- |
| SPEC-000 | [Fundação do runtime](000-fundacao-runtime.md) | F0 | Validada localmente |
| SPEC-001 | [Relógio e métricas](001-relogio-e-metricas.md) | F0–F4 | Proposta revisada; fechamento de contratos pendente |
| SPEC-100 | [Mundo físico: terreno, clima e água](100-mundo-fisico.md) | F1 | Rascunho; parâmetros aguardam cenário |
| SPEC-200 | [Solo, vegetação e decomposição](200-vegetacao-e-decomposicao.md) | F2 | Rascunho; perfis/taxas pendentes |
| SPEC-300 | [Biologia animal e populações](300-biologia-animal.md) | F3 | Rascunho; perfis/calibração pendentes |
| SPEC-400 | [Aprendizado online e evolução](400-aprendizado-e-evolucao.md) | F4 | Rascunho experimental; parâmetros pendentes |

O estado “validada localmente” registra a evidência e o ambiente descritos no relatório F0; não declara compatibilidade entre plataformas nem aprova F1 ou o gate natural. Ver [roadmap](../09-roadmap.md) e [validação documental](../12-validacao-documental.md).

## Como uma spec fica completa

Cada spec deve registrar:

- objetivo, escopo, dependências e itens explicitamente fora de escopo;
- estado, eventos, comandos e contratos de dados;
- unidades, limites, defaults e cadência de atualização;
- fontes, transferências e perdas quando houver estoques;
- comportamento em erro e requisitos de save/migração;
- cenários determinísticos, critérios de aceite e limites do modelo;
- decisões abertas que bloqueiam implementação ou calibração.

Uma decisão pode ser marcada como **proposta**, **aceita**, **implementada** ou **validada**. “Validada” exige evidência do runtime e dos testes descritos; texto documental sozinho nunca passa um gate.

## Ordem de elaboração

1. SPEC-000 e SPEC-001: execução reproduzível e medição comparável.
2. SPEC-100: escala espacial e temporal do mundo físico, balanços de água e cenários climáticos.
3. SPEC-200: unidades e fluxos de solo, plantas e decomposição.
4. SPEC-300: corpo, custos, reprodução e populações.
5. SPEC-400: observações, ações, aprendizado online, herança e protocolo experimental.

As specs F1–F4 devem escolher parâmetros em cenários identificados, sem apresentá-los como constantes universais da biologia. O gate natural de [09-roadmap.md](../09-roadmap.md) continua obrigatório antes do planejamento detalhado de pessoas.

Pendências por fase e resultado da revisão conjunta: [validação documental](../12-validacao-documental.md). Antes de marcar uma spec como aceita, fechar as decisões bloqueantes, anexar schemas/fixtures correspondentes e registrar a revisão; calibração de jogo pode continuar depois da implementação verificável.
