from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.shortcuts import render
from django.contrib.auth.models import User
from .models import Well, GeologyLayer
from .serializers import WellSerializer, GeologyLayerSerializer


class WellViewSet(viewsets.ModelViewSet):
    queryset = Well.objects.all().select_related("created_by")
    serializer_class = WellSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        print("Полученные данные:", request.data)  # Логируем входящие данные

        # Создаем или получаем пользователя по умолчанию
        try:
            user = User.objects.first()
            if not user:
                # Создаем тестового пользователя если нет пользователей
                user = User.objects.create_user(
                    username="field_geologist",
                    email="geologist@example.com",
                    password="temp_password",
                )
        except Exception as e:
            print("Ошибка с пользователем:", e)
            return Response(
                {"error": "Проблема с пользователем"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Копируем данные и добавляем created_by
        data = request.data.copy()
        if isinstance(data, dict):
            data["created_by"] = user.id
        else:
            # Если data не dict (например QueryDict), создаем новый dict
            data = {
                "name": request.data.get("name"),
                "area": request.data.get("area"),
                "structure": request.data.get("structure"),
                "planned_depth": request.data.get("planned_depth", 0),
                "created_by": user.id,
            }

        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            print("Данные валидны, сохраняем...")
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            print("Ошибки валидации:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GeologyLayerViewSet(viewsets.ModelViewSet):
    queryset = GeologyLayer.objects.all()
    serializer_class = GeologyLayerSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        well_id = self.request.query_params.get("well_id")
        if well_id:
            return GeologyLayer.objects.filter(well_id=well_id)
        return GeologyLayer.objects.all()

    def perform_create(self, serializer):
        well = serializer.validated_data["well"]
        last_layer = (
            GeologyLayer.objects.filter(well=well).order_by("-layer_number").first()
        )
        next_number = (last_layer.layer_number + 1) if last_layer else 1
        serializer.save(layer_number=next_number)


def pwa_app(request):
    return render(request, "index.html")
