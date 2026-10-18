# Contrato para IAs

Leia README.md e os documentos de domínio antes de alterar código: visão, GDD, simulação, indivíduo e arquitetura.

Regras obrigatórias:
- Phaser + TypeScript + Vite são a base do cliente.
- O estado da simulação é a fonte de verdade; Phaser, sprites e DOM são projeções descartáveis.
- A simulação e o aprendizado rodam em Web Worker e usam mensagens tipadas.
- Redes neurais aprendem dentro do jogo; não adicionar modelos pré-treinados, ONNX, PyTorch ou inferência remota ao runtime inicial.
- Regras de mundo e IA devem ser testáveis sem navegador.
- IDs persistentes, saves, eventos e mods são versionados.
- Não colocar regras de jogo em callbacks de cena ou HUD.
- Não incluir dependência, mudança de save ou mudança de mod sem atualizar docs e testes.

Para cada alteração: declarar escopo, preservar contratos, adicionar teste determinístico, executar typecheck/test/build, registrar limitações e atualizar ADR quando a decisão for durável. Nunca apagar saves ou adicionar segredos.

## Prioridade obrigatória de produção

Leia docs/09-roadmap.md e docs/10-ecologia-e-biologia.md antes de escolher tarefas. O marco atual é F0; F0–F4 não incluem humanos. Só iniciar planejamento detalhado humano após evidências do gate natural. A visão futura de tribos, profissões e impérios não autoriza sua implementação antecipada.

Módulos naturais não dependem de sociedade. Ações, dados, assets e UI obedecem às capacidades da fase. Plantas e decompositores podem usar regras agregadas; redes online individuais começam na fauna. Não anunciar como implementados os sistemas apenas especificados.

Mudanças documentais exigem leitura de coerência e validação dos links; comandos de build/test só se aplicam quando houver implementação e ferramentas correspondentes.
