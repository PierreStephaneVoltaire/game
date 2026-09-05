# Apply this bootstrap stack with an operator identity before PR planning.
# Use the existing state backend with key = "ci-access.tfstate".
terraform {
  required_version = ">= 1.10.0, < 2.0.0"
  backend "azurerm" {}
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
  resource_provider_registrations = "none"
}

provider "azuread" {}

data "azuread_application" "ci" {
  client_id = "238c6c2c-4a36-4682-a0a9-eb93f1e4f707"
}

data "azuread_service_principal" "ci" {
  client_id = data.azuread_application.ci.client_id
}

data "azurerm_resource_group" "app" {
  name = "legally-distinct-virtual-pet-rg"
}

data "azurerm_resource_group" "state" {
  name = "legally-distinct-tamagotchi-tfstate-rg"
}

resource "azuread_application_federated_identity_credential" "pull_request" {
  application_id = data.azuread_application.ci.id
  display_name   = "github-pull-request"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:PierreStephaneVoltaire/game:pull_request"
}

resource "azurerm_role_assignment" "app" {
  scope                = data.azurerm_resource_group.app.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_service_principal.ci.object_id
}

resource "azurerm_role_assignment" "state" {
  scope                = "${data.azurerm_resource_group.state.id}/providers/Microsoft.Storage/storageAccounts/ldttfstate87782d2129d8/blobServices/default/containers/tfstate"
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azuread_service_principal.ci.object_id
}
