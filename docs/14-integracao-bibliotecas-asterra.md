# Bibliotecas ASTERRA — integração ao Spectators-of-Life

## Limites e módulos
- Wind: fluxo procedural reutilizável; não conhece plantas.
- Leaves: morfologia, ciclo foliar e cache; usado por Vegetation e Trees.
- Vegetation: gramíneas, rasteiras e arbustos; usa Leaves e Wind.
- Trees: árvores; usa Leaves.
- Rocks: geologia visual; independente.

**Leaves e Vegetation devem permanecer separados** para que
o gerador foliar possa ser compartilhado por árvores e arbustos.

## Implementado nesta branch
A biblioteca interna src/lib/asterra/vegetation/grass-autotile.ts
representa visualmente a cobertura com autotile 8-direções, usando
biomassa já simulada pelo Core F2. A imagem pixel art é composta em
src/render/asterra-grass-overlay.ts, separada da cena.
A FoundationScene orquestra apenas o adaptador.

O módulo substitui os três círculos representando gramíneas, mantendo
a renderização de arbustos e árvores existente. Não adiciona outra
simulação de germinação, dispersão, competição ou mortalidade.

## Pacote ASTERRA v0.2.0
A distribuição completa continua disponível no ZIP separado
ASTERRA_Bibliotecas_Modulares_JS_v0.2.0_Completo.zip.
Para incorporar os cinco pacotes, copiar packages/ para
vendor/asterra-libs/packages, registrar os workspaces npm, lockfile,
licenças e revisar os exports antes de migrar imports. Não adicionar
dependência de pasta inexistente.

## Verificação
Executar npm run check, testes determinísticos, comparação de saves,
e benchmarks P50/P95 do Phaser. Confirmar que ativar/desativar a
cobertura não altera o estado do Worker. O autotile é puro e não
requer Phaser nos testes headless.

## Limites desta primeira integração
Os geradores completos Leaves, Trees, Wind e Rocks ainda não foram
substituídos pelos pacotes v0.2.0 dentro da cena. Recomendação:
migrá-los gradualmente, mantendo compatibilidade com os assets
e perfis atuais, em mudanças menores que possam ser revertidas.
