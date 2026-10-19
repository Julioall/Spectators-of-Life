# Arquitetura de código e integração

## Stack

TypeScript, Phaser e Vite. Web Worker para simulação e aprendizado. DOM/CSS para HUD, menus, inspeção e filtros. IndexedDB ou adaptador para saves; JSON versionado para export/import.

## Camadas

src/core: estado, tick, sistemas, eventos e invariantes.
src/ai: MLP, aprendizado, memória, mutação e herança.
src/worker: loop, protocolo e checkpoints.
src/render: cenas Phaser, câmera, entidades e efeitos.
src/ui: HUD DOM compacto, menus flutuantes, fichas contextuais, filtros e acessibilidade. A UI projeta a seleção e os módulos ativos em uma única tela; não mantém dashboards ou painéis laterais permanentes como navegação principal.
src/assets: manifesto, loader e validação.
src/mods: schemas, dependências, conflitos e load order.
src/platform: persistência, arquivos e adaptadores.
src/debug: seed, replay, métricas e diagnósticos.
tests/core, tests/ai e tests/integration para contratos.

Core e IA não importam Phaser nem DOM. Scenes são finas e projetam snapshots. Objetos visuais são descartáveis; estado persistente nunca fica em sprite, scene ou componente.

## Mensagens

A aplicação oferece iniciar, pausar, avançar, mudar velocidade, selecionar, salvar e carregar. Pausa/velocidade controlam o driver no cliente; seleção e câmera são estado de apresentação. O protocolo Worker F0 é definido na [SPEC-000](specs/000-fundacao-runtime.md): CREATE_WORLD, STEP, GET_SNAPSHOT, SAVE, LOAD e DISPOSE, com respostas correlacionadas. F0 usa snapshots completos. Deltas e comandos de sandbox exigem extensão versionada posterior; não são mensagens implementadas. O cliente mantém no máximo um pedido de estado em voo e confirma pausa após sua conclusão.

## Código, save e plataforma

Preferir tipos discriminados, funções puras e dependências explícitas. Logs incluem tick, seed, sistema e entidade. Dependência nova exige custo, compatibilidade, licença e ADR. Saves contêm apenas dados de simulação, genoma, cérebro, config, seed, versão e histórico; migrações são testadas. APIs de sistema passam por adaptadores.

## Módulos por fase e dependências

- core/world: terreno, tempo, clima, hidrologia e solo.
- core/ecology: vegetação, recursos, detritos e decomposição.
- core/biology: metabolismo, saúde, desenvolvimento, reprodução e mortalidade.
- ai: percepção animal, controladores, aprendizado e memória.
- core/evolution: traços, linhagens e herança.
- core/humans, core/culture, core/economy, core/politics: extensões futuras, ativadas a partir de F5, F6, F7 e F8 respectivamente.

Os nomes acima são organização planejada, não diretórios já implementados. Economia e política dependem da base natural; a base natural nunca importa economia ou política. Evitar construir infraestrutura social vazia antes de F5.

O catálogo de módulos declara IDs, versão, dependências, cadência e fase de resolução. Cenário natural não carrega módulos, assets ou painéis humanos. Save registra módulos ativos; não exige rei, profissão, cidade ou cultura em toda entidade. Ações e observações são contratos por capacidade, não um enum universal com todas as profissões.

Cadência biológica, decisão neural e renderização são independentes. O orçamento de aprendizado é determinístico em quantidade de operações. Aceleração processa mais ticks; sobrecarga reduz a velocidade efetiva e informa o observador, sem pular regras silenciosamente.

O roadmap canônico está em [09-roadmap.md](09-roadmap.md). O contrato natural está em [10-ecologia-e-biologia.md](10-ecologia-e-biologia.md). Não é necessário executar build nesta revisão documental: o repositório ainda não contém runtime.
