variable "storage_account_id" {
  type = string
}

resource "azurerm_storage_table" "shop_items" {
  name               = "ShopItems"
  storage_account_id = var.storage_account_id

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_table" "global_rules" {
  name               = "GlobalRules"
  storage_account_id = var.storage_account_id

  lifecycle {
    prevent_destroy = true
  }
}

output "table_names" {
  value = [
    azurerm_storage_table.shop_items.name,
    azurerm_storage_table.global_rules.name
  ]
}
