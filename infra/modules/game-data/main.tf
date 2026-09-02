variable "storage_account_id" {
  type = string
}

resource "azurerm_storage_table" "game_data" {
  name               = "GameData"
  storage_account_id = var.storage_account_id

  lifecycle {
    prevent_destroy = true
  }
}

output "table_names" {
  value = [azurerm_storage_table.game_data.name]
}
