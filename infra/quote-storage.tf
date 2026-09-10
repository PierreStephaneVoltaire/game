data "azurerm_client_config" "quotes" {}

data "azurerm_storage_account" "quotes" {
  name                = "legallydistinctvi95b050d"
  resource_group_name = var.resource_group_name
}

resource "azurerm_storage_container" "quotes" {
  name                  = "companion-content"
  storage_account_id    = data.azurerm_storage_account.quotes.id
  container_access_type = "private"
}

resource "azurerm_role_assignment" "quote_reader" {
  scope                = azurerm_storage_container.quotes.id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = data.azurerm_client_config.quotes.object_id
}
