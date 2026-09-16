import { buildValuation as buildBase } from './valuation-engine-base.js';
import { normalizeProjectionScoring, VALUATION_VERSION } from './projection-normalizer.js';
import { enrichPlayerAdvice } from './player-advice-engine.js';

export { VALUATION_VERSION };

export async function buildValuation(context, options={}) {
  const data = await buildBase(context, options);
  await normalizeProjectionScoring(context, data);
  await enrichPlayerAdvice(context, data);
  return data;
}
