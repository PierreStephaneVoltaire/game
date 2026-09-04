variable "name" {
  description = "Application resource-name stem supplied by the environment configuration."
  type        = string
  default     = "legally-distinct-virtual-pet"
}

variable "resource_group_name" {
  description = "Existing resource group that owns the application."
  type        = string
}

variable "env_type" {
  type    = string
  default = "test"
}

variable "app_base_url" {
  description = "Public application origin. This is not a secret."
  type        = string
  default     = "http://localhost:5173"
}

variable "discord_client_id" {
  description = "Public Discord application client ID."
  type        = string
  default     = ""
}

variable "discord_callback_url" {
  description = "Discord OAuth callback URL. Defaults to APP_BASE_URL/api/auth/discord/callback."
  type        = string
  default     = ""
}

variable "entra_admin_login" {
  description = "Display name of the Microsoft Entra administrator."
  type        = string
}
