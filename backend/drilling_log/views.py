from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import render
from .models import Well, GeologyLayer
from .serializers import WellSerializer, GeologyLayerSerializer


class WellViewSet(viewsets.ModelViewSet):
    queryset = Well.objects.all().select_related("created_by")
    serializer_class = WellSerializer
    permission_classes = [permissions.AllowAny]  # Временно для тестирования

    def perform_create(self, serializer):
        # Берем первого пользователя, так как аутентификация отключена
        first_user = User.objects.first()
        serializer.save(created_by=first_user)


class GeologyLayerViewSet(viewsets.ModelViewSet):
    queryset = GeologyLayer.objects.all()
    serializer_class = GeologyLayerSerializer
    permission_classes = [permissions.AllowAny]  # Временно для тестирования

    def get_queryset(self):
        # Фильтруем по well_id если передан
        well_id = self.request.query_params.get("well_id")
        if well_id:
            return GeologyLayer.objects.filter(well_id=well_id)
        return GeologyLayer.objects.all()

    def perform_create(self, serializer):
        # Автоматически устанавливаем номер слоя
        well = serializer.validated_data["well"]
        last_layer = (
            GeologyLayer.objects.filter(well=well).order_by("-layer_number").first()
        )
        next_number = (last_layer.layer_number + 1) if last_layer else 1
        serializer.save(layer_number=next_number)


# View для PWA
def pwa_app(request):
    return render(request, "index.html")
