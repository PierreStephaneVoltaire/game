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

variable "database_location" {
  description = "Region for the shared PostgreSQL server; Burstable SKUs are restricted in some regions."
  type        = string
}

variable "owner_admin" {
  description = "Human Microsoft Entra user who stays PostgreSQL administrator regardless of who applies."
  type        = object({ login = string, object_id = string })
}

variable "ci_admin" {
  description = "CI service principal granted PostgreSQL administration and quote read access."
  type        = object({ login = string, object_id = string })
}

variable "telemetry_ingest_principal_id" {
  type    = string
  default = ""
}

variable "monthly_budget" {
  description = "Subscription budget alert amount in the billing currency."
  type        = number
  default     = 80
}
