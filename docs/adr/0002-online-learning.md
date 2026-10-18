# ADR 0002 — Aprendizado online sem pré-treino

Status: aceita.

Decisão: MLP pequena em TypeScript com atualização incremental, memória compacta e herança configurável. Não usar modelo pré-treinado, ONNX, PyTorch ou inferência remota no runtime inicial.

Consequência: comportamento mais simples, porém auditável, serializável e determinístico.