variable "storage_account_id" {
  type = string
}

resource "azurerm_storage_table" "users" {
  name               = "Users"
  storage_account_id = var.storage_account_id

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_table" "auth_records" {
  name               = "AuthRecords"
  storage_account_id = var.storage_account_id

  lifecycle {
    prevent_destroy = true
  }
}

output "users_table_name" {
  value = azurerm_storage_table.users.name
}

output "auth_records_table_name" {
  value = azurerm_storage_table.auth_records.name
}

output "table_names" {
  value = [
    azurerm_storage_table.users.name,
    azurerm_storage_table.auth_records.name
  ]
}
