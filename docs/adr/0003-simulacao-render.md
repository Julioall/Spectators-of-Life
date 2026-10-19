# ADR 0003 — Separar simulação e renderização

Status: aceita.

Decisão: estado em core no Web Worker; Phaser e DOM recebem snapshots e enviam comandos tipados. F0 usa snapshots completos conforme a SPEC-000; deltas dependem de extensão versionada posterior. Objetos visuais são reconstruíveis.

Consequência: mais contratos, mas determinismo, replay, testes e performance tornam-se viáveis.