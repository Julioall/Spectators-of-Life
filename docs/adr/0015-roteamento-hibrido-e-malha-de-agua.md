# ADR 0015 — Roteamento híbrido e malha visual de água

- Status: aceito para a implementação inicial do cenário natural
- Data: 2026-10-20

## Contexto

A literatura comparativa indica que D8 é simples, determinístico e produz uma
topologia de canais legível, mas introduz viés de grade e não representa bem a
contribuição lateral em encostas divergentes. MFD/D-infinity reduzem parte
desse viés, porém podem espalhar artificialmente a posição do caminho d'água.
O projeto também precisa manter saves compactos, regras headless e uma
renderização de rios que não pareça uma coleção de tiles quadrados.

## Decisão

- Preservar `terrain.flowTo` como a aresta D8 autoritativa do estado persistido.
- Durante a geração, calcular um campo derivado de contribuição múltipla,
  ponderado por chuva e declive. Esse campo só apoia a expansão lateral do
  leito e não cria uma segunda verdade de roteamento nem consome RNG.
- Adaptar o limiar de início de canais por chuva local, declive e escala da
  célula. A topologia continua reproduzível por seed e o limiar não é alterado
  durante os ticks.
- Preservar depressões selecionadas e o fluxo fill–spill–connect já existente;
  o tratamento não usa preenchimento global que apague lagos naturais.
- Renderizar trechos ativos como uma faixa preenchida alinhada à tangente do
  caminho, com margem externa e largura derivada de contribuição, profundidade
  e confluência. A geometria é criada em `src/render/water-mesh.ts` como
  projeção descartável. A animação continua em camada separada e usa o fluxo
  real para orientar reflexos.
- Transformar os contornos celulares de lagos, rios, poças e leitos secos em
  margens orgânicas por suavização de Chaikin e ruído determinístico de baixa e
  alta frequência. A mesma semente visual e amplitude são usadas na máscara de
  sombreamento para evitar halos quadrados; o agrupamento continua sendo
  derivado da conectividade 4-vizinhos do estado.

## Consequências e limites

Rios úmidos e íngremes podem iniciar antes, enquanto áreas secas e células
  maiores exigem mais área contribuinte. A contribuição múltipla melhora a
  leitura de margens e alargamentos sem dispersar a rede autoritativa. As
  margens deixam de repetir retângulos por célula, mas a forma orgânica é uma
  projeção visual: a malha não altera a conectividade nem é um solver de águas
  rasas, portanto não calcula velocidade, tensão de cisalhamento ou meandros
  físicos.
  A calibração continua dependente da resolução de 250 m e dos parâmetros do
  cenário; as simplificações e a ausência de validação hidrológica de campo
  permanecem explícitas.

## Evidência e validação

A síntese aplicada do SciSpace/Consensus, com citações preservadas, está em
[pesquisa de hidrologia e malha de água](../research/2026-10-20-hidrologia-malha-agua-consensus.md).
Os invariantes headless cobrem contribuição derivada e limiar adaptativo em
`tests/core/flow-routing.test.ts`; a geometria de faixa e o contorno orgânico
determinístico são verificados em `tests/render/water-mesh.test.ts`.
