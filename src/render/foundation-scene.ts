import Phaser from 'phaser';

export class FoundationScene extends Phaser.Scene {
  private titleText: Phaser.GameObjects.Text | null = null;
  private tickText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('foundation');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101916');
    this.titleText = this.add.text(0, 0, 'MUNDO VAZIO · F0', {
      color: '#d7e3d9',
      fontFamily: 'monospace',
      fontSize: '18px',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.tickText = this.add.text(0, 0, 'Tick —', {
      color: '#82978b',
      fontFamily: 'monospace',
      fontSize: '13px',
    }).setOrigin(0.5);
    this.scale.on('resize', this.layout, this);
    this.layout({ width: this.scale.width, height: this.scale.height });
  }

  showTick(tick: number | null): void {
    this.tickText?.setText(tick === null ? 'Tick —' : `Tick ${tick.toLocaleString('pt-BR')}`);
  }

  setCameraView(x: number, y: number, zoom: number): void {
    this.cameras.main.setScroll(x, y).setZoom(zoom);
  }

  private layout(size: { width: number; height: number }): void {
    this.titleText?.setPosition(size.width / 2, size.height / 2 - 14);
    this.tickText?.setPosition(size.width / 2, size.height / 2 + 16);
  }
}
