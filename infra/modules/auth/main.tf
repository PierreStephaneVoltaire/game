variable "app_base_url" { type = string }
variable "discord_client_id" { type = string }
variable "discord_callback_url" { type = string }
variable "session_cookie_name" {
  type    = string
  default = "session"
}
variable "session_ttl_days" {
  type    = number
  default = 30
}

output "app_settings" {
  value = {
    APP_BASE_URL         = var.app_base_url
    DISCORD_CLIENT_ID    = var.discord_client_id
    DISCORD_CALLBACK_URL = var.discord_callback_url
    SESSION_COOKIE_NAME  = var.session_cookie_name
    SESSION_TTL_DAYS     = tostring(var.session_ttl_days)
  }
}
