# Arquitetura de código e integração

## Stack

TypeScript, Phaser e Vite. Web Worker para simulação e aprendizado. DOM/CSS para HUD, menus, inspeção e filtros. IndexedDB ou adaptador para saves; JSON versionado para export/import.

## Camadas

src/core: estado, tick, sistemas, eventos e invariantes.
src/ai: MLP, aprendizado, memória, mutação e herança.
src/worker: loop, protocolo e checkpoints.
src/render: cenas Phaser, câmera, entidades e efeitos.
src/ui: HUD DOM, painéis, filtros e acessibilidade.
src/assets: manifesto, loader e validação.
src/mods: schemas, dependências, conflitos e load order.
src/platform: persistência, arquivos e adaptadores.
src/debug: seed, replay, métricas e diagnósticos.
tests/core, tests/ai e tests/integration para contratos.

Core e IA não importam Phaser nem DOM. Scenes são finas e projetam snapshots. Objetos visuais são descartáveis; estado persistente nunca fica em sprite, scene ou componente.

## Mensagens

Entradas: iniciar cenário, pausar, avançar, velocidade, selecionar, comando de sandbox, salvar e carregar. Saídas: pronto, snapshot, delta, evento, métrica, erro recuperável e diagnóstico. Toda mensagem tem tipo, versão, payload validado e requestId quando necessário.

## Código, save e plataforma

Preferir tipos discriminados, funções puras e dependências explícitas. Logs incluem tick, seed, sistema e entidade. Dependência nova exige custo, compatibilidade, licença e ADR. Saves contêm apenas dados de simulação, genoma, cérebro, config, seed, versão e histórico; migrações são testadas. APIs de sistema passam por adaptadores.