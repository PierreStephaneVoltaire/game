terraform {
  required_providers {
    azapi = {
      source = "Azure/azapi"
    }
  }
}

variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_id" { type = string }
variable "app_settings" { type = map(string) }

resource "azapi_resource" "this" {
  type      = "Microsoft.Web/staticSites@2023-12-01"
  name      = "${var.name}-web"
  location  = var.location
  parent_id = var.resource_group_id

  body = {
    properties = {
      stagingEnvironmentPolicy = "Enabled"
    }
    sku = {
      name = "Free"
      tier = "Free"
    }
  }

  response_export_values = ["properties.defaultHostname"]
}

resource "azapi_update_resource" "app_settings" {
  type        = "Microsoft.Web/staticSites/config@2023-12-01"
  resource_id = "${azapi_resource.this.id}/config/appsettings"

  body = {
    properties = var.app_settings
  }
}

output "name" { value = azapi_resource.this.name }
output "hostname" { value = azapi_resource.this.output.properties.defaultHostname }
