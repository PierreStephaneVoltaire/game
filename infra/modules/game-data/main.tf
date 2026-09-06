output "app_settings" {
  value = {
    MAX_GAMES_PER_USER   = "20"
    MAX_EVENTS_PER_GAME  = "50000"
    MAX_EVENTS_PER_BATCH = "500"
    MAX_STATE_BYTES      = "262144"
    MAX_EVENT_BYTES      = "16384"
    MAX_SYNC_ATTEMPTS    = "60"
    SYNC_WINDOW_SECONDS  = "300"
  }
}
