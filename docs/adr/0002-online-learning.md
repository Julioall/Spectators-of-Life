# ADR 0002 — Aprendizado online sem pré-treino

Status: aceita.

Decisão: aprendizado online no runtime TypeScript, com estado individual e memória limitada. A MLP com saídas Q e atualização TD é o candidato experimental de F4; topologia e hiperparâmetros ainda exigem contrato e ensaios. Herança genética é o padrão; cópia direta de pesos é um experimento opcional separado. Não usar modelo pré-treinado, ONNX, PyTorch ou inferência remota no runtime inicial.

Consequência: comportamento mais simples, com requisitos de auditabilidade, serialização e repetição no ambiente testado; convergência e desempenho ainda não medidos.