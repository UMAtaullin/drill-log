from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Well, LithologySample, DailyReport
from .serializers import (
    WellSerializer,
    LithologySampleSerializer,
    DailyReportSerializer,
)


class WellViewSet(viewsets.ModelViewSet):
    serializer_class = WellSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Well.objects.all().select_related("created_by")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class LithologySampleViewSet(viewsets.ModelViewSet):
    serializer_class = LithologySampleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return LithologySample.objects.filter(
            collected_by=self.request.user
        ).select_related("well", "collected_by")

    def perform_create(self, serializer):
        serializer.save(collected_by=self.request.user)

    @action(detail=False, methods=["get"])
    def by_well(self, request, well_id=None):
        """Все пробы по конкретной скважине"""
        samples = self.get_queryset().filter(well_id=well_id)
        serializer = self.get_serializer(samples, many=True)
        return Response(serializer.data)


class DailyReportViewSet(viewsets.ModelViewSet):
    serializer_class = DailyReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return DailyReport.objects.filter(reported_by=self.request.user).select_related(
            "well", "reported_by"
        )

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)

    @action(detail=False, methods=["get"])
    def by_well(self, request, well_id=None):
        """Все отчеты по конкретной скважине"""
        reports = self.get_queryset().filter(well_id=well_id)
        serializer = self.get_serializer(reports, many=True)
        return Response(serializer.data)


from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Получить информацию о текущем пользователе"""
    return Response(
        {
            "id": request.user.id,
            "username": request.user.username,
            "first_name": request.user.first_name,
            "last_name": request.user.last_name,
            "email": request.user.email,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def api_status(request):
    """Статус API"""
    return Response(
        {
            "status": "active",
            "message": "Drilling Log API работает",
            "user": request.user.username,
        }
    )
