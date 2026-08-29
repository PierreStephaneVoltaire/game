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
