# ADR 0014 — Drenagem fluvial guiada pelo relevo

**Status:** Aceita para a implementação inicial no cenário natural.

**Data:** 20/10/2026

## Contexto

O traçado fluvial anterior combinava caminhos desenhados por custo geométrico com as direções de drenagem locais. Isso criava cortes que não acompanhavam o relevo e deixava alguns cursos desconectados. A chuva também ficava em lâminas por célula, e uma depressão fechada podia reter água indefinidamente sem se tornar um lago.

## Decisão

- Na versão `natural:temperate-valley@1.11.0`, selecionar cursos permanentes pela acumulação de chuva e seguir a rede D8 já derivada da altitude. Canais conectados devem descer até um lago, sumidouro ou saída do mapa; a geração não deve forçar um percurso entre bordas que contradiga essa drenagem.
- Calcular a rota do passo por carga hidráulica (`elevação + água superficial`) e processar células em ordem decrescente de carga, permitindo que a chuva escoe por mais de uma célula no mesmo passo. Transferências internas continuam conservando água; só evaporação e descarga de borda são perdas.
- Quando há um vizinho com menor carga, encaminhar pelo menos 82% e no máximo 98% do excedente superficial após a infiltração. Solo e declive hidráulico modulam a fração; sem saída descendente, reter água para preencher a depressão.
- Reunir água que alcança uma depressão local conectada ao sumidouro. Nivelar a lâmina no footprint abaixo da soleira; ao atingir a soleira, devolver o excedente à célula de saída para que possa seguir a jusante nos passos seguintes. O evento `hydrology:lake-formed` registra células novas e matéria vegetal afogada.
- Renderizar águas temporárias como componentes de contorno suavizado. Desenhar seus fluxos seguindo `lastFlowTo`, com largura variável e reflexos animados na direção real; o leito permanente continua sendo uma projeção do caminho físico.
- Preservar o comportamento das versões anteriores via versionamento do cenário e atualizar os enums do save e do protocolo Worker para aceitar `1.11.0`.

## Consequências e limites

A rede gerada e o escoamento de chuva passam a concordar com o relevo numérico, e a apresentação deixa de sugerir células quadradas isoladas. O solver é D8, diário e agregado: não resolve hidrodinâmica subdiária, sedimentos por velocidade, aquíferos ou meandros em resolução fina. A formação de lagos usa uma aproximação de nível uniforme dentro da depressão e parâmetros de jogo, sem calibração geológica. Testes determinísticos cobrem encaminhamento em cascata, direção descendente, lago em depressão fechada, conservação da água e regressões de conexão/alargamento dos rios.
