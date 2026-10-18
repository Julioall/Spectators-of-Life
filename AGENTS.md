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