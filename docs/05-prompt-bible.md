# Prompt Bible

AGENTS.md define as regras do repositório. Este arquivo define como formular pedidos para IAs de código, design, arte, documentação e revisão.

## Contexto obrigatório

Objetivo verificável; arquivos e contratos a ler; escopo permitido; fora do escopo; comportamento; compatibilidade de save, mod e replay; testes; budget; formato da entrega.

## Código

Peça diagnóstico antes da correção quando a causa não estiver comprovada. Exija menor diff modular, tipos, testes determinísticos, comando executado, arquivos alterados e limitações.

## Design

Informe fantasia, verbo do jogador, câmera, estado observado, causa legível, referências, anti-padrões e critério de playtest.

## Arte

Informe espécie ou objeto, top-down, escala, grade, silhueta, paleta, âncora bottom-center, direção, frames, transparência, seed, referência aprovada e licença. Gerar a tira completa a partir de um frame-semente; não aprovar frames isolados que mudem proporção.

## Experimento de IA

Declarar pergunta, cenário, seed, versão, algoritmo, hiperparâmetros, população, duração, política de herança e métricas. Comparar baseline e execuções.

## Saída

Resumo; arquivos; contratos afetados; testes; evidências; limitações; risco seguinte. Prompts registram ferramenta, seed, data, licença e motivo de aprovação ou rejeição.

## Contrato de fase

Todo pedido informa fase do roadmap, dependências concluídas e critério de aceite. F0–F4 não incluem pessoas, tribos, cultivo humano, profissões ou política. Ecossistema deve continuar funcional sem módulos sociais.

Exemplo para a primeira implementação:
“Implemente F0: core de mundo vazio, tick fixo, RNG serializável, Worker e inspeção de tick/seed. Leia AGENTS, arquitetura e roadmap. Entregue pausa, avanço e save/load reproduzível. Valide sem dependência de Phaser no core. Informe comandos executados e limitações.”

Exemplo ecológico futuro:
“Implemente o reservatório de água do solo de F1. Declare unidades, entradas, saídas, intervalo lógico, capacidade e tolerância do balanço. Teste chuva, saturação e seca com seeds fixas. Exponha estoque e fluxos na inspeção.”

Para pixel art, a produção padrão é desenho procedural por código com seeds visuais independentes do RNG da simulação. Geração de imagem é referência opcional, não dependência obrigatória.
