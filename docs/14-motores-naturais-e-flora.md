# Motores naturais internos

O código procedural recebido foi reorganizado como módulos permanentes do jogo. A aplicação importa arquivos internos por caminhos relativos; não há workspaces npm nem dependências externas para folhas, árvores, vegetação, vento ou rochas.

## Integração ativa

- **Árvores e folhas:** `Trees` usa `createTreeEngine` para rasterizar quadros procedurais por espécie e estágio. A copa é separada da madeira e recebe deslocamento e rotação discretos do campo de vento. A seleção do quadro é escalonada em seis faixas; a escala interpolada continuamente acompanha idade e biomassa. A renderização não avança a biologia.
- **Gramíneas:** o adaptador Phaser desenha touceiras individuais com os presets `grama_fina` e `capim_ornamental` via `PlantRenderer`. Biomassa e densidade das coortes controlam quantidade, escala e opacidade. Chunks em cache preservam culling e redesenho incremental; o autotile de cobertura permanece disponível apenas para o laboratório/módulo independente.
- **Arbustos:** a cena converte coortes `shrub` em presets internos conforme habitat, idade, biomassa e estresse. A geometria G4 é redesenhada em orçamento incremental para aplicar o mesmo vento periódico às folhas, sem criar coortes nem alterar o crescimento simulado.
- **Vento:** a cena cria um `WindField` compartilhado com gramíneas, arbustos e copas de árvores, com parâmetros visuais alinhados ao laboratório G5.3. A amostragem muda apenas a apresentação; não altera clima, biomassa nem o Worker.
- **Rochas:** a cena mantém o gerador de afloramentos já usado no jogo, agora dentro de `Geosphere/Rendering/Rocks`. O módulo procedimental adicional também está dentro do projeto.

## Ainda não conectado ao runtime

As árvores usam o modo `g244` e o módulo de folhas G8, com paleta, densidade, ângulo e seis limites de crescimento alinhados ao laboratório G5.3. A geração de quadros permanece em fila e com cache; cada trabalho individual ainda é síncrono e pode exceder o orçamento de 3 ms em mapas densos. O vento das árvores move a copa rasterizada como uma camada, enquanto G4 de gramíneas e arbustos aplica flexão por haste/folha. A cobertura visível também depende das coortes que existem no snapshot; sementes com pouca biomassa naturalmente mostram menos vegetação que a cena de laboratório densamente povoada.

## Fronteiras

1. O Worker e o estado natural continuam como fonte da verdade; o Canvas, Phaser e os atlas são projeções descartáveis.
2. Motores de apresentação leem snapshots/coortes e não avançam ciclos de crescimento.
3. Touceiras procedurais não criam população nem substituem fotossíntese, competição ou mortalidade do sistema natural. O autotile e a cobertura visual do motor standalone não fazem parte da projeção da partida.
4. `npm run test:engines` executa os testes dos módulos internos; `npm run check` inclui essa verificação junto das verificações do jogo.

## Desempenho da projeção

- O ensaio natural separa tempo por sistema do Worker, criação do snapshot e cópia do estado. O painel de desenvolvimento mede quadros, camadas Phaser, catálogo/rasterização de rochas, vegetação e água sem alterar a simulação.
- A projeção de grama guarda assinaturas visuais por célula e reaproveita chunks. Só células alteradas são reprojetadas; o runtime de folhas e o redesenho dos chunks são fatiados entre quadros.
- Árvores, arbustos e sombras usam recorte da câmera, assinaturas por célula e invalidação local. A animação da copa move apenas a camada foliar; arbustos atualizam textura de forma incremental. Chunks de sombra são reconstruídos gradualmente.
- Rochas são indexadas espacialmente em chunks; a cena só cria sprites para formações na câmera. O LOD oculta depósitos pequenos e espalhados quando o mapa está afastado, preservando afloramentos maiores; a rasterização detalhada só começa no zoom 1,25×, pois pode exceder o orçamento de um quadro em rochas grandes.
- A superfície de água mantém uma máscara e assinaturas de profundidade/luz em cache. Apenas chunks sujos de 8×8 células são redesenhados, com limite por quadro; a geometria dos corpos d'água ainda é refeita quando a camada natural muda.

Essas otimizações afetam somente a projeção Phaser. Elas não mudam a frequência da simulação no Worker, regras hidrológicas, estado lógico ou determinismo do mundo. O custo ainda depende do tamanho do mapa, densidade de objetos e quantidade de células hidrológicas alteradas; o limite de chunks evita concentrar todo o redesenho da água em um único quadro, mas não garante 60 FPS em mapas densos.
