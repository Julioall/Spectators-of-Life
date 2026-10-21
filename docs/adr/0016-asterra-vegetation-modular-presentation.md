# Arquitetura ASTERRA — Flora como módulo biológico

## Regra principal
**Módulos representam sistemas naturais. Renderers apresentam o estado, não são sistemas ecológicos.**

- Flora/Domain: espécies, coortes, saúde, estágios.
- Flora/Simulation: fotossíntese, crescimento, competição, água/nutrientes, reprodução, morte.
- Flora/Contracts: estado ambiental, eventos e snapshots.
- Flora/Rendering: estratégias de desenhar árvores, arbustos, folhas e **Grass**.

**Grass** é o submódulo de renderização. **Autotile é uma estratégia interna de Grass**, não uma biblioteca nem submódulo biológico. O sistema poderá trocar autotile por malhas, sprites, GPU ou LOD sem alterar contratos ou simulação.

**Folhas (Leaves)** continua uma biblioteca de geometria independente, compartilhável entre árvores e arbustos. Envelhecimento, doença, danos e queda das folhas pertencem à biologia da Flora; a biblioteca foliar apenas representa seus efeitos visuais.

## Arquivos principais
- `src/modules/biosphere/flora/domain/plant-state.ts`
- `src/modules/biosphere/flora/domain/species.ts`
- `src/modules/biosphere/flora/simulation/flora-system.ts`
- `src/modules/biosphere/flora/contracts/flora-environment.ts`
- `src/modules/biosphere/flora/contracts/flora-snapshot.ts`
- `src/modules/biosphere/flora/contracts/flora-events.ts`
- `src/modules/biosphere/flora/rendering/grass/grass.ts`
- `src/modules/biosphere/flora/rendering/grass/strategies/autotile.ts`
- `src/modules/biosphere/flora/rendering/grass/adapters/phaser/grass-renderer.ts`

## Outras bibliotecas
- Atmosphere/Wind: vento ambiental; Flora/Rendering responde aos campos de vento
- Geosphere/Rocks: rochas, minerais e solo; renderizador geológico separado
- Flora/Rendering/Trees e Flora/Rendering/Shrubs: etapa de extração do código da FoundationScene
- Biosphere/Fauna: módulo futuro; consulta contratos, sem importar classes gráficas da Flora

## Regras
1. Web Worker é fonte da verdade: render nunca avança tick e não grava biomassa.
2. Vegetação nasce em coortes simuladas; o gramado visual é projeção, sem criar população fantasma.
3. A biblioteca pode funcionar sem Phaser, Canvas, DOM e câmera.
4. Eventos comunicam domínios; evitar dependências circulares.
5. Como a aplicação é um experimento, não há camadas extras de compatibilidade com saves antigos.

## Próximas extrações
Mover render de árvores, copas, sombra, arbustos e Rocks para seus módulos específicos, e integrar os pacotes externos ASTERRA como técnicas gráficas. Não duplicar lógica biológica para satisfazer o aspecto visual.
