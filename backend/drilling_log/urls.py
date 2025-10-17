from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WellViewSet,
    LithologySampleViewSet,
    DailyReportViewSet,
    current_user,
    api_status,
)

router = DefaultRouter()
router.register(r"wells", WellViewSet, basename="wells")
router.register(r"samples", LithologySampleViewSet, basename="samples")
router.register(r"reports", DailyReportViewSet, basename="reports")

urlpatterns = [
    path("", include(router.urls)),
    path("current-user/", current_user, name="current-user"),
    path("status/", api_status, name="api-status"),
]
