variable "content_schema_version" {
  type    = number
  default = 1
}

variable "content_bundle_max_bytes" {
  type    = number
  default = 2097152
}

output "app_settings" {
  value = {
    CONTENT_SCHEMA_VERSION   = tostring(var.content_schema_version)
    CONTENT_BUNDLE_MAX_BYTES = tostring(var.content_bundle_max_bytes)
  }
}
