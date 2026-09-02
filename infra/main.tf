module "web" {
  source = "./modules/web"

  name        = var.name
  location    = var.region
  environment = var.env_type
}

output "url" {
  value = module.web.url
}

output "deployment_token" {
  value     = module.web.deployment_token
  sensitive = true
}

output "storage_account_name" {
  value = module.web.storage_account_name
}

output "table_names" {
  value = module.web.table_names
}
