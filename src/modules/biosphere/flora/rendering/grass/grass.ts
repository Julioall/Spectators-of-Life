/** Grass is the Flora renderer; autotile is a replaceable rendering technique. */
import {generateGrassTileFrame,type GrassSample,type GrassTileFrame} from './strategies/autotile';
export type {GrassSample,GrassTileFrame};
export type GrassRenderTechnique='autotile';
export class Grass {
  static renderData(cells:readonly GrassSample[],width:number,height:number,seed:number,detail=4,technique:GrassRenderTechnique='autotile'):GrassTileFrame{
    switch(technique){case 'autotile':return generateGrassTileFrame(cells,width,height,seed,detail);}
  }
}
