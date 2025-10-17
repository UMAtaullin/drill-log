from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def api_root(request):
    return JsonResponse(
        {
            "message": "Drilling Log API",
            "version": "1.0",
            "endpoints": {
                "admin": "/admin/",
                "api": "/api/",
                "wells": "/api/wells/",
                "samples": "/api/samples/",
                "reports": "/api/reports/",
            },
        }
    )


urlpatterns = [
    path("", api_root),
    path("admin/", admin.site.urls),
    path("api/", include("drilling_log.urls")),
]
