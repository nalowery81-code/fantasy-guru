#!/usr/bin/env Rscript

suppressPackageStartupMessages({
  library(ffanalytics)
  library(dplyr)
  library(jsonlite)
})

season <- as.integer(format(Sys.Date(), "%Y"))
if (season < 2026) season <- 2026L

# Keep FantasyPros out of this pipeline. Each source is attempted independently
# so one broken scraper cannot wipe out the entire daily update.
sources <- c(
  "CBS",
  "ESPN",
  "FantasySharks",
  "FFToday",
  "FleaFlicker",
  "NumberFire",
  "Yahoo",
  "NFL",
  "RTSports",
  "Walterfootball"
)
positions <- c("QB", "RB", "WR", "TE", "K", "DST")

message("Fantasy Guru ffanalytics refresh for season ", season)
message("Sources: ", paste(sources, collapse = ", "))

scrapes <- list()
working_sources <- character()
failed_sources <- character()

for (src in sources) {
  message("Scraping ", src, "...")
  one <- tryCatch(
    ffanalytics::scrape_data(
      src = src,
      pos = positions,
      season = season,
      week = 0
    ),
    error = function(e) {
      message("FAILED ", src, ": ", conditionMessage(e))
      NULL
    }
  )

  if (is.null(one)) {
    failed_sources <- c(failed_sources, src)
    next
  }

  # Preserve source rows by position. scrape_data returns a named list of tibbles.
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

if (!length(working_sources)) {
  stop("No ffanalytics sources returned usable data; leaving existing JSON untouched.")
}

attr(scrapes, "season") <- season
attr(scrapes, "week") <- 0L

# source_points calculates fantasy points independently for each publisher.
# Fantasy Guru then takes a plain arithmetic mean across the available publishers.
# No historical-accuracy weighting and no model-generated projection is introduced.
source_pts <- ffanalytics::source_points(scrapes, scoring_rules = ffanalytics::scoring)
source_pts <- source_pts %>%
  filter(!is.na(id), !is.na(raw_points), is.finite(raw_points))

if (!nrow(source_pts)) {
  stop("ffanalytics returned no usable source-level projected points; leaving existing JSON untouched.")
}

# Pull the package player table for names / identifiers where available.
player_table <- tryCatch(get("player_table", envir = asNamespace("ffanalytics")), error = function(e) NULL)
if (is.null(player_table) || !nrow(player_table)) {
  player_table <- tibble(id = unique(source_pts$id))
}

pick_col <- function(df, candidates) {
  hit <- candidates[candidates %in% names(df)]
  if (length(hit)) hit[[1]] else NA_character_
}

id_col <- pick_col(player_table, c("id", "mfl_id", "player_id"))
name_col <- pick_col(player_table, c("name", "full_name", "player_name"))
pos_col <- pick_col(player_table, c("pos", "position"))
gsis_col <- pick_col(player_table, c("gsis_id", "gsis"))
espn_col <- pick_col(player_table, c("espn_id", "espn"))

meta <- tibble(id = as.character(player_table[[id_col]]))
meta$name <- if (!is.na(name_col)) as.character(player_table[[name_col]]) else NA_character_
meta$position <- if (!is.na(pos_col)) as.character(player_table[[pos_col]]) else NA_character_
meta$gsis_id <- if (!is.na(gsis_col)) as.character(player_table[[gsis_col]]) else NA_character_
meta$espn_id <- if (!is.na(espn_col)) as.character(player_table[[espn_col]]) else NA_character_

source_pts <- source_pts %>% mutate(id = as.character(id))

players <- source_pts %>%
  group_by(id, pos) %>%
  summarise(
    ros_points = mean(raw_points, na.rm = TRUE),
    floor = if (n() >= 2) min(raw_points, na.rm = TRUE) else NA_real_,
    ceiling = if (n() >= 2) max(raw_points, na.rm = TRUE) else NA_real_,
    source_count = n_distinct(data_src),
    sources = list(sort(unique(as.character(data_src)))),
    source_values = list(setNames(as.list(raw_points), as.character(data_src))),
    .groups = "drop"
  ) %>%
  left_join(meta, by = "id") %>%
  mutate(
    name = ifelse(is.na(name) | name == "", id, name),
    position = ifelse(is.na(position) | position == "", pos, position),
    sleeper_id = NA_character_
  ) %>%
  select(name, position, gsis_id, sleeper_id, espn_id, ros_points, floor, ceiling,
         source_count, sources, source_values)

out <- list(
  schema_version = "1.1",
  season = season,
  generated_at = format(Sys.time(), tz = "UTC", usetz = TRUE),
  source = "ffanalytics",
  projection_type = "rest_of_season",
  scoring_basis = "ffanalytics default scoring; equal arithmetic mean of available source-level projected points",
  averaging_rule = "equal_weight",
  requested_sources = sources,
  working_sources = unique(working_sources),
  failed_sources = unique(failed_sources),
  players = players
)

dir.create("data", recursive = TRUE, showWarnings = FALSE)
jsonlite::write_json(out, "data/ffanalytics_projections.json", pretty = TRUE, auto_unbox = TRUE, na = "null")
message("Wrote ", nrow(players), " players from ", length(unique(working_sources)), " working sources.")
