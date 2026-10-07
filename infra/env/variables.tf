variable "env" {
  description = "Deployment environment this state manages."
  type        = string

  validation {
    condition     = contains(["prod", "stage"], var.env)
    error_message = "Use prod or stage."
  }
}

variable "name" {
  description = "Application resource-name stem."
  type        = string
  default     = "legally-distinct-virtual-pet"
}

variable "resource_group_name" {
  description = "Existing resource group that owns the application."
  type        = string
}

variable "storage_account_name" {
  description = "Existing storage account for quotes and telemetry."
  type        = string
}

variable "discord_client_id" {
  description = "Public Discord application client ID."
  type        = string
  default     = ""
}

variable "ci_admin" {
  description = "CI service principal that administers the shared PostgreSQL server."
  type        = object({ login = string, object_id = string })
}

variable "database_runtime_username" {
  description = "PostgreSQL Entra role granted DML access for the API identity."
  type        = string
  default     = "vpet_api"
}
