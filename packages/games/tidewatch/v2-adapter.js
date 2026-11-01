import {draft} from './v2.js';
import {tidewatch as legacy} from './legacy.js';
export const tidewatchV2={...draft,manifest:{...legacy.manifest,rulesVersion:'2',stateVersion:2}};
