resource "azurerm_dns_a_record" "apex" {
  count               = local.is_prod ? 1 : 0
  name                = "@"
  zone_name           = local.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = 3600
  target_resource_id  = module.static_app.id
}

resource "azurerm_static_web_app_custom_domain" "apex" {
  count             = local.is_prod ? 1 : 0
  static_web_app_id = module.static_app.id
  domain_name       = local.host_name
  validation_type   = "dns-txt-token"
}


resource "azurerm_dns_txt_record" "apex_validation" {
  count               = local.is_prod ? 1 : 0
  name                = "_dnsauth"
  zone_name           = local.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = 3600

  record {
    value = coalesce(azurerm_static_web_app_custom_domain.apex[0].validation_token, "validated")
  }

  lifecycle { ignore_changes = [record] }
}

resource "azurerm_dns_cname_record" "subdomain" {
  count               = local.is_prod ? 0 : 1
  name                = var.env
  zone_name           = local.zone_name
  resource_group_name = var.resource_group_name
  ttl                 = 3600
  record              = module.static_app.hostname
}

resource "azurerm_static_web_app_custom_domain" "subdomain" {
  count             = local.is_prod ? 0 : 1
  depends_on        = [azurerm_dns_cname_record.subdomain]
  static_web_app_id = module.static_app.id
  domain_name       = local.host_name
  validation_type   = "cname-delegation"
}
