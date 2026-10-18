# AI Game Design Document

## Gênero e loop

Jogo de observação e simulação emergente em pixel art top-down. O loop é: gerar ou carregar seed; observar; pausar, acelerar ou avançar; selecionar entidade; consultar necessidades, relações, linhagem e eventos; comparar populações; salvar replay ou cenário.

Intervenção direta fica fora do núcleo. Um sandbox futuro deve ser separado e marcado como experimento.

## Escalas

Tick, dia, estação, ano e era. Luz, clima, crescimento, atividade, reprodução, colheita, política e sucessão usam escalas coerentes.

## Mundo natural

Células e regiões possuem altitude, relevo, temperatura, umidade, fertilidade e cobertura. O ciclo da água move umidade entre água, solo, vegetação, atmosfera e chuva. Plantas preferem faixas de solo, luz, temperatura e umidade. Herbívoros procuram plantas e água; predadores procuram presas, mas competem com fome, energia, risco e território; decomposição devolve matéria ao solo.

## Sociedades

Indivíduos formam famílias, grupos, aldeias, cidades e reinos. Trabalho, plantio, construção, reputação, sucessão, diplomacia e guerra são consequências de recursos e relações, não telas separadas.

## Indivíduos

Cada indivíduo possui ID, espécie, idade, corpo, necessidades, traços, genoma, pesos, memória compacta, relações, posição, grupo e eventos. Necessidades iniciais: energia, hidratação, segurança, descanso, temperatura, saúde e vínculo social quando aplicável.

## Primeiro slice

Dois biomas, água e clima; duas plantas e três espécies; 50–200 indivíduos; cadeia alimentar; morte e reprodução; rede pequena com aprendizado online; herança configurável; inspeção e replay; renderização a 60 FPS no desktop de referência.