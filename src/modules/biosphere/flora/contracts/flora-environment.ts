import type {NaturalWorldCellState} from '../../../../core/natural/types';
/** Environmental observations from Atmosphere, Hydrosphere and Geosphere. */
export type FloraEnvironment=Readonly<Pick<NaturalWorldCellState,'climate'|'water'|'soil'|'terrain'>>;
