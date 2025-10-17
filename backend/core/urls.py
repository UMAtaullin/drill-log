from django.contrib import admin
from django.urls import path
from django.http import JsonResponse


def home(request):
    return JsonResponse(
        {
            "message": "Drilling Log API",
            "status": "working",
            "endpoints": {"admin": "/admin/", "api": "/api/coming-soon/"},
        }
    )


urlpatterns = [
    path("", home),
    path("admin/", admin.site.urls),
]
