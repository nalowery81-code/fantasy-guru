#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(ffanalytics)
  library(dplyr)
  library(tidyr)
  library(jsonlite)
})

season <- as.integer(format(Sys.Date(), "%Y"))
if (season < 2026) season <- 2026L

# FantasyPros stays excluded. ESPN is also intentionally excluded here because
# Fantasy Guru already consumes ESPN directly as its own independent projection
# pillar. Keeping ESPN out prevents double-counting ESPN inside the crowd source.
sources <- c(
  "CBS", "FantasySharks", "FFToday", "FleaFlicker",
  "NumberFire", "Yahoo", "NFL", "RTSports", "Walterfootball"
)
positions <- c("QB", "RB", "WR", "TE", "K", "DST")

stat_whitelist <- c(
  "pass_att","pass_comp","pass_inc","pass_yds","pass_tds","pass_int",
  "pass_40_yds","pass_300_yds","pass_350_yds","pass_400_yds","pass_2pt",
  "rush_att","rush_yds","rush_tds","rush_40_yds","rush_100_yds",
  "rush_150_yds","rush_200_yds","rush_2pt",
  "rec","rec_yds","rec_tds","rec_40_yds","rec_100_yds","rec_150_yds",
  "rec_200_yds","rec_2pt","fum","fum_lost",
  "xpm","xpa","fgm","fga","fgm_0_19","fgm_20_29","fgm_30_39",
  "fgm_40_49","fgm_50p","fgmiss",
  "dst_int","dst_fum_rec","dst_sack","dst_safety","dst_td","dst_blk_kick",
  "dst_ret_td","dst_pts_allowed","dst_yds_allowed"
)

message("Fantasy Guru ffanalytics refresh for season ", season)
message("Independent crowd sources (ESPN excluded): ", paste(sources, collapse = ", "))

scrapes <- list()
working_sources <- character()
failed_sources <- character()

for (src in sources) {
  message("Scraping ", src, "...")
  one <- tryCatch(
    ffanalytics::scrape_data(src = src, pos = positions, season = season, week = 0),
    error = function(e) {
      message("FAILED ", src, ": ", conditionMessage(e))
      NULL
    }
  )
  if (is.null(one)) {
    failed_sources <- c(failed_sources, src)
    next
  }
  if (!length(scrapes)) {
    scrapes <- one
  } else {
    for (pos in union(names(scrapes), names(one))) {
      a <- scrapes[[pos]]
      b <- one[[pos]]
      if (is.null(a)) scrapes[[pos]] <- b
      else if (!is.null(b)) scrapes[[pos]] <- bind_rows(a, b)
    }
  }
  working_sources <- c(working_sources, src)
}

if (!length(working_sources)) stop("No ffanalytics sources returned usable data; leaving existing JSON untouched.")
attr(scrapes, "season") <- season
attr(scrapes, "week") <- 0L

source_pts <- ffanalytics::source_points(scrapes, scoring_rules = ffanalytics::scoring) %>%
  filter(!is.na(id), !is.na(raw_points), is.finite(raw_points)) %>%
  mutate(id = as.character(id))

stat_rows <- list()
for (pos in names(scrapes)) {
  df <- scrapes[[pos]]
  if (is.null(df) || !nrow(df) || !("id" %in% names(df))) next
  keep <- intersect(stat_whitelist, names(df))
  if (!length(keep)) next
  if (!("data_src" %in% names(df))) df$data_src <- "unknown"
  one <- df %>%
    mutate(id = as.character(id)) %>%
    select(id, data_src, all_of(keep)) %>%
    pivot_longer(cols = all_of(keep), names_to = "stat", values_to = "value") %>%
    mutate(value = suppressWarnings(as.numeric(value))) %>%
    filter(!is.na(id), id != "", !is.na(value), is.finite(value)) %>%
    group_by(id, stat) %>%
    summarise(value = mean(value, na.rm = TRUE), source_count = n_distinct(data_src), .groups = "drop")
  one$pos <- pos
  stat_rows[[pos]] <- one
}
stat_long <- bind_rows(stat_rows)
if (!nrow(stat_long)) stop("No usable projected stat rows were produced; leaving existing JSON untouched.")

player_table <- tryCatch(get("player_table", envir = asNamespace("ffanalytics")), error = function(e) NULL)
if (is.null(player_table) || !nrow(player_table)) player_table <- tibble(id = unique(stat_long$id))

pick_col <- function(df, candidates) {
  hit <- candidates[candidates %in% names(df)]
  if (length(hit)) hit[[1]] else NA_character_
}

id_col <- pick_col(player_table, c("id", "mfl_id", "player_id"))
pos_col <- pick_col(player_table, c("pos", "position"))
gsis_col <- pick_col(player_table, c("gsis_id", "gsis"))
espn_col <- pick_col(player_table, c("espn_id", "espn"))
name_col <- pick_col(player_table, c("name", "full_name", "player_name"))
first_col <- pick_col(player_table, c("first_name", "firstname"))
last_col <- pick_col(player_table, c("last_name", "lastname"))

meta <- tibble(id = as.character(player_table[[id_col]]))
if (!is.na(name_col)) {
  meta$name <- as.character(player_table[[name_col]])
} else if (!is.na(first_col) || !is.na(last_col)) {
  first <- if (!is.na(first_col)) as.character(player_table[[first_col]]) else rep("", nrow(player_table))
  last <- if (!is.na(last_col)) as.character(player_table[[last_col]]) else rep("", nrow(player_table))
  meta$name <- trimws(paste(first, last))
} else {
  meta$name <- NA_character_
}
meta$position <- if (!is.na(pos_col)) as.character(player_table[[pos_col]]) else NA_character_
meta$gsis_id <- if (!is.na(gsis_col)) as.character(player_table[[gsis_col]]) else NA_character_
meta$espn_id <- if (!is.na(espn_col)) as.character(player_table[[espn_col]]) else NA_character_
meta <- meta %>% distinct(id, .keep_all = TRUE)

default_pts <- source_pts %>%
  group_by(id, pos) %>%
  summarise(
    default_scoring_points = mean(raw_points, na.rm = TRUE),
    source_count = n_distinct(data_src),
    sources = list(sort(unique(as.character(data_src)))),
    .groups = "drop"
  )

keys <- stat_long %>% distinct(id, pos)
players <- vector("list", nrow(keys))
for (i in seq_len(nrow(keys))) {
  kid <- keys$id[[i]]
  kpos <- keys$pos[[i]]
  s <- stat_long %>% filter(id == kid, pos == kpos)
  m <- meta %>% filter(id == kid) %>% slice_head(n = 1)
  d <- default_pts %>% filter(id == kid, pos == kpos) %>% slice_head(n = 1)
  stats <- as.list(setNames(s$value, s$stat))
  stat_source_counts <- as.list(setNames(s$source_count, s$stat))
  nm <- if (nrow(m) && !is.na(m$name[[1]]) && m$name[[1]] != "") m$name[[1]] else kid
  ppos <- if (nrow(m) && !is.na(m$position[[1]]) && m$position[[1]] != "") m$position[[1]] else kpos
  players[[i]] <- list(
    name = nm,
    position = ppos,
    gsis_id = if (nrow(m) && !is.na(m$gsis_id[[1]]) && m$gsis_id[[1]] != "") m$gsis_id[[1]] else NULL,
    sleeper_id = NULL,
    espn_id = if (nrow(m) && !is.na(m$espn_id[[1]]) && m$espn_id[[1]] != "") m$espn_id[[1]] else NULL,
    consensus_stats = stats,
    stat_source_counts = stat_source_counts,
    default_scoring_points = if (nrow(d) && is.finite(d$default_scoring_points[[1]])) d$default_scoring_points[[1]] else NULL,
    source_count = if (nrow(d)) d$source_count[[1]] else max(s$source_count, na.rm = TRUE),
    sources = if (nrow(d)) d$sources[[1]] else character()
  )
}

out <- list(
  schema_version = "2.0",
  season = season,
  generated_at = format(Sys.time(), tz = "UTC", usetz = TRUE),
  source = "ffanalytics independent crowd consensus",
  projection_type = "season_projection_stats",
  scoring_basis = "unscored source-stat consensus; score at request time with exact league rules",
  averaging_rule = "equal_weight_by_stat",
  requested_sources = sources,
  working_sources = unique(working_sources),
  failed_sources = unique(failed_sources),
  excluded_sources = c("ESPN", "FantasyPros"),
  players = players
)

dir.create("data", recursive = TRUE, showWarnings = FALSE)
jsonlite::write_json(out, "data/ffanalytics_projections.json", pretty = TRUE, auto_unbox = TRUE, null = "null", na = "null")
message("Wrote ", length(players), " players with independent rescorable consensus stats from ", length(unique(working_sources)), " working sources.")
