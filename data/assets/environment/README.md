# Referências e recursos de ambiente

Este conjunto reúne referências visuais fornecidas para a futura apresentação do terreno de Spectators of Life. Os PNGs estão catalogados em `../manifest.json`; `reviewed` significa que foram inspecionados e catalogados, não que já estejam carregados pelo jogo.

## Conteúdo adicionado

- `references/asterra-terrain-autotile-atlas.png`: imagem de referência fornecida pelo usuário (192 × 896 px). A dimensão sugere uma grade de 64 × 64 px, mas os recortes não têm funções ou correspondência com máscaras documentadas; manter como referência até concluir esse mapeamento.
- `asterra-v4/oak.png`, `oakwide.png`, `pine.png`, `shrub.png`, `rocks.png` e `mountain.png`: sprites ambientais do pacote `Asterra_Tilemap_Solo_Rios_v4.zip`.
- `asterra-v4/rivercurve.png`: curva de rio estática do mesmo pacote, mantida como referência visual. Ela não descreve água, altitude ou fluxo da simulação.

O manifesto do pacote informa “Criado para Asterra” para esses sprites, mas não identifica autor nem licença. Esses campos continuam sem confirmação no manifesto do projeto. As imagens foram adicionadas como recursos locais fornecidos pelo usuário.

O restante do pacote não foi copiado: casas, fazenda, muralhas e assentamentos não pertencem às fases F1–F4; fauna é conteúdo de F3. O gerador de variações incluído no outro ZIP trabalha sobre sprites existentes e não é um gerador de solo, então seu código não foi integrado. As rochas já têm um pacote próprio em `data/assets/rocks/`.

## Direção para o terreno procedural

1. A simulação define elevação, substrato, água e clima. O renderer consulta esses dados e não os altera.
2. Compor cada célula por camadas: textura-base do substrato, bordas/transições de materiais, água derivada do estado hídrico e detalhes decorativos. Separar as regras de conexão do desenho da textura.
3. Usar vizinhos para selecionar bordas e cantos. Um bitmask dos oito vizinhos pode representar adjacências; regras podem normalizar combinações redundantes para reduzir o número de sprites necessários. Manter o preenchimento-base separado das bordas permite trocar paleta ou textura sem refazer a topologia.
4. Derivar variações decorativas de uma seed visual e de coordenadas estáveis. A seed visual nunca consome o RNG ecológico, e o resultado não depende de câmera, FPS ou ordem de renderização.
5. Confirmar a unidade física da célula e a função de cada recorte antes de usar a folha de referência como atlas de runtime. As dimensões dos sprites maiores também não definem tamanho físico de célula.

Essas são notas de direção, não uma escolha definitiva de tileset nem uma implementação. O autotiling é uma camada de apresentação; bacias, rios, umidade e relevo vêm do estado físico da SPEC-100.

O renderer atual adapta a técnica do `world.js` de `Asterra_Tilemap_Solo_Rios_v4`: textura-base determinística e máscaras de vizinhança para as transições de terreno e água. A imagem de referência continua fora do runtime até a função de cada recorte estar mapeada.

## Leituras de referência

- [GameMaker Autotile Templates — OpenGameArt](https://opengameart.org/content/gamemaker-autotile-templates): exemplos CC0 de templates de 16 e 47 tiles para orientar o mapeamento de vizinhança; os templates não foram copiados.
- [Unity 2D Tilemaps — MadWomb](https://www.madwomb.com/tutorials/GameDesign_Unity2DTilemap.html): camadas de base e transição, recorte em grade e regras de borda; os passos específicos de Unity não se aplicam diretamente ao renderer Phaser.
- [Autotiling Technique — Excalibur.js](https://excaliburjs.com/blog/Autotiling%20Technique/): bitmask de oito vizinhos, mapeamento de padrões e separação entre base e sobreposição.

As referências explicam técnicas de renderização. Não são parâmetros de terreno, clima ou hidrologia.
