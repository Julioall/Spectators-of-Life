import Phaser from 'phaser';
import type {PlantCohortState,NaturalWorldCellState} from '../../../../../core/natural/types';

/** Visual appearance of shrub cohorts, replaceable independently of their ecology. */
export class Shrubs{
 static draw(graphics:Phaser.GameObjects.Graphics,cell:NaturalWorldCellState,shrub:PlantCohortState|undefined,cellSize:number):void{
   if(!shrub||shrub.biomassGPerM2<=2||cell.water.surfaceMm>=7)return;
   const radius=Math.min(10,Math.max(4,4+Math.sqrt(shrub.biomassGPerM2)*.22));
   const cx=(cell.x+.5)*cellSize,cy=(cell.y+.5)*cellSize;
   graphics.fillStyle(0x526f38,.88);
   graphics.fillCircle(cx+7,cy+5,radius);
   graphics.fillStyle(0x819453,.85);
   graphics.fillCircle(cx+5,cy+2,radius*.62);
   graphics.fillStyle(0xc2d275,.52);
   graphics.fillCircle(cx+5,cy+1,radius*.24);
 }
}
