import { buildSourceBundle, normalizePlayer } from './projection-source-normalizer.js';
import { rebuildNormalizedAnalysis } from './normalized-analysis.js';

export const VALUATION_VERSION = '4.1-league-rescored';

export async function normalizeProjectionScoring(context, data) {
  const bundle = await buildSourceBundle(context);
  const summary = {
    version: VALUATION_VERSION,
    espn_weekly_exact: 0,
    espn_weekly_rescored: 0,
    sleeper_weekly_rescored: 0,
    sleeper_weekly_unavailable: 0,
    ffanalytics_weekly_rescored: 0,
    unsupported_categories: new Set()
  };

  const rostered = (data?.team_details || []).flatMap(t => t?.players || []);
  const waivers = Array.isArray(data?.waiver_pool) ? data.waiver_pool : [];
  for (const p of rostered) normalizePlayer(context, p, bundle, summary);
  for (const p of waivers) normalizePlayer(context, p, bundle, summary);

  rebuildNormalizedAnalysis(context, data);

  data.source_policy = {
    version: VALUATION_VERSION,
    consensus: 'Equal average of available independent sources after league-scoring normalization.',
    espn: String(context?.platform || '').toUpperCase() === 'ESPN' ? 'platform exact applied totals when available; otherwise target-league rescored raw ESPN stats' : 'target-league rescored raw ESPN stats',
    sleeper: 'raw Sleeper projected stats rescored to the selected league supported linear rules',
    ffanalytics: 'consensus projected stats rescored to the selected league supported linear rules',
    missing_source: 'Missing stays missing and is never converted to zero.',
    unsupported_rule: 'Unsupported nonlinear categories are flagged rather than guessed.'
  };

  data.scoring_integrity = {
    version: VALUATION_VERSION,
    rostered_players_checked: rostered.length,
    waiver_players_checked: waivers.length,
    espn_weekly_exact: summary.espn_weekly_exact,
    espn_weekly_rescored: summary.espn_weekly_rescored,
    sleeper_weekly_rescored: summary.sleeper_weekly_rescored,
    sleeper_weekly_unavailable: summary.sleeper_weekly_unavailable,
    ffanalytics_weekly_rescored: summary.ffanalytics_weekly_rescored,
    unsupported_categories: [...summary.unsupported_categories],
    fallback_policy: 'If raw Sleeper stats cannot be rescored, Sleeper is unavailable for that observation; generic PPR is not substituted.'
  };

  data.decision_policy = {
    framework: 'outside-view + market-efficiency',
    base_rate_rule: 'Start with longer-term talent, role and opportunity before reacting to one recent game.',
    regression_rule: 'Treat extreme recent outcomes as noisy unless role, usage, health or team context materially changed.',
    uncertainty_rule: 'Small projection edges do not justify confident action when source disagreement or evidence quality is weak.',
    marginal_value_rule: 'Judge moves by improvement over the exact alternative, replacement player and optimized starting lineup, not standalone player value.',
    market_rule: 'Separate expected football production from market price and look for durable mispricing rather than popularity.',
    hold_rule: 'HOLD is preferred when the expected edge is smaller than the uncertainty or transaction cost.',
    learning_rule: 'Do not change source weights from stories or small samples; require locked out-of-sample evidence first.'
  };

  return data;
}
