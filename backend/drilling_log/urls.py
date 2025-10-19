from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WellViewSet, GeologyLayerViewSet

router = DefaultRouter()
router.register(r"wells", WellViewSet, basename="wells")
router.register(r"layers", GeologyLayerViewSet, basename="layers")

urlpatterns = [
    path("", include(router.urls)),
]
