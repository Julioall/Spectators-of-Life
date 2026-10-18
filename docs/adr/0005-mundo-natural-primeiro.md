# ADR 0005 — Mundo natural antes de humanos

Status: aceita por orientação do usuário em 18/10/2026.

## Contexto

O README enfatizava apenas impérios e o roadmap agrupava toda a sociedade em um marco. As especificações também misturavam ações animais e instituições humanas, permitindo que a implementação antecipasse política antes da ecologia.

## Decisão

Adotar [09-roadmap.md](../09-roadmap.md) como ordem canônica: F0–F4 mundo físico, ecologia, biologia, aprendizado e evolução; F5 indivíduos humanos; F6 tribos; F7 aldeias e especialização; F8 Estados; F9 impérios.

O escopo ecológico obrigatório está em [10-ecologia-e-biologia.md](../10-ecologia-e-biologia.md). Seu gate precisa ser atendido antes do planejamento detalhado e implementação humana. Direções sociais de alto nível permanecem documentadas.

## Consequências

Core natural funciona sem módulos humanos. Pessoas reutilizam seus custos e ciclos biológicos. UI, assets, testes e dados priorizam natureza. Complexidade social é possibilidade habilitada por módulos; nunca cronômetro de progresso obrigatório.

A decisão complementa ADRs 0001–0004 e substitui a ordem resumida anterior do roadmap. Nenhuma funcionalidade é declarada implementada por esta revisão.
