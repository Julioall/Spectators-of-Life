# ADR 0001 — Phaser + TypeScript + Vite

Status: aceita.

Contexto: mapa 2D, câmera, sprites, animação, browser e futuro empacotamento multiplataforma.

Decisão: Phaser para render, TypeScript para runtime, Vite para build e adaptadores de plataforma para storage, arquivos e fullscreen.

Consequência: stack portátil; exige core independente de Phaser e UI densa fora do canvas.