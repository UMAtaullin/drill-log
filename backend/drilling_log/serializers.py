from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Well, LithologySample, DailyReport


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name")


class WellSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Well
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")


class LithologySampleSerializer(serializers.ModelSerializer):
    well_name = serializers.CharField(source="well.name", read_only=True)
    rock_type_display = serializers.CharField(
        source="get_rock_type_display", read_only=True
    )
    collected_by_name = serializers.CharField(
        source="collected_by.get_full_name", read_only=True
    )

    class Meta:
        model = LithologySample
        fields = "__all__"
        read_only_fields = ("collected_at",)


class DailyReportSerializer(serializers.ModelSerializer):
    well_name = serializers.CharField(source="well.name", read_only=True)
    reported_by_name = serializers.CharField(
        source="reported_by.get_full_name", read_only=True
    )

    class Meta:
        model = DailyReport
        fields = "__all__"
        read_only_fields = ("created_at",)
