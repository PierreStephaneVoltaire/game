# Retain the resources recorded by the original hosting stack while adopting
# the Static Web App under AzAPI. These state changes occur only on apply.
removed {
  from = module.web.azurerm_resource_group.this
  lifecycle { destroy = false }
}

removed {
  from = module.web.azurerm_static_web_app.this
  lifecycle { destroy = false }
}

import {
  to = module.static_app.azapi_resource.this
  id = "${data.azurerm_resource_group.existing.id}/providers/Microsoft.Web/staticSites/${var.name}-web"
}
