# Especificação da IA do indivíduo

## Separação

Genoma contém metabolismo, sensores, predisposições e pesos iniciais. Cérebro contém pesos atuais, vieses, memória, contadores e métricas. Estado contém necessidades, posição, relações e contexto. Fenótipo é a combinação dos três com o ambiente.

## Observação e ações

Observação é vetor numérico normalizado e versionado: energia, água, alimento e perigo por direção, abrigo, temperatura, hora, estação, familiaridade, aliados, reputação e custo.

Ações são enumeradas por espécie: mover, investigar, comer, beber, descansar, fugir, perseguir, comunicar, cooperar, coletar, plantar, construir, negociar, recrutar, atacar e recuar. Máscara remove ações sem energia, ferramenta, alvo, conhecimento ou permissão.

## Aprendizado

O primeiro controlador é um MLP pequeno em TypeScript. A saída é valor por ação ou logits; a escolha usa exploração limitada. O update inicial é TD/Q-learning incremental após a transição, com fallback heurístico para estados inválidos. Taxa, desconto, exploração e limites numéricos são configuráveis.

Memória é um buffer compacto e estatísticas por contexto. Atualizações ocorrem em lotes pequenos no Worker. O cérebro é serializável e determinístico.

## Evolução

Cada cenário declara uma política: Darwiniana, em que o cérebro reinicia; Baldwiniana, em que o aprendizado ajuda a sobreviver e só o genoma é herdado; ou Lamarckiana controlada, em que pesos ou resumos são herdados com ruído e limites. Registrar pais, mutações, cérebro inicial e ambiente.

## Recompensa e métricas

Recompensa decompõe energia, alimento, segurança, reprodução, cooperação, construção e custos de dano, colisão, risco e desperdício. Registrar idade, sobrevivência, ações, recompensa, entropia, updates, memória e causa de morte; por população, diversidade, gerações, reprodução, migração e extinção.

Não usar modelo pré-treinado, ONNX, PyTorch ou inferência remota no runtime inicial. Alterar entradas, saídas ou arquitetura exige nova versão do cérebro e migração de save.