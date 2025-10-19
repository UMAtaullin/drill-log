from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Well, GeologyLayer
from .serializers import WellSerializer, GeologyLayerSerializer


class WellViewSet(viewsets.ModelViewSet):
    queryset = Well.objects.all().select_related("created_by")
    serializer_class = WellSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class GeologyLayerViewSet(viewsets.ModelViewSet):
    serializer_class = GeologyLayerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GeologyLayer.objects.filter(well__created_by=self.request.user)

    def perform_create(self, serializer):
        # Автоматически устанавливаем номер слоя
        well = serializer.validated_data["well"]
        last_layer = (
            GeologyLayer.objects.filter(well=well).order_by("-layer_number").first()
        )
        next_number = (last_layer.layer_number + 1) if last_layer else 1
        serializer.save(layer_number=next_number)
