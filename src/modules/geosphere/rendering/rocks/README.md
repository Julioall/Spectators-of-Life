# Renderização procedural de rochas

`legacy-engine.js` contém os trechos originais do gerador de rochas v2.3 e `procedural-rocks.ts` adapta seus descritores à distribuição mineral e geológica do mundo atual. O motor não lê bitmaps e o adaptador não altera o estado da simulação.

`legacy-settings.ts` converte os atributos do mundo em parâmetros visuais. `engine.js` contém o motor procedural adicional recebido no kit. A extração da referência original pode ser reproduzida com `node scripts/extract-rock-engine.mjs`; os hashes ficam em `provenance.json`.

A cópia-fonte original permanece arquivada em `data/assets/rocks/asterra/` para procedência e comparação. O runtime importa somente os módulos TypeScript/JavaScript desta pasta.
