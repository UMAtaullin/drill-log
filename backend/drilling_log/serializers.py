from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Well, GeologyLayer


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name")


class GeologyLayerSerializer(serializers.ModelSerializer):
    thickness = serializers.SerializerMethodField()
    lithology_display = serializers.CharField(
        source="get_lithology_display", read_only=True
    )

    class Meta:
        model = GeologyLayer
        fields = "__all__"

    def get_thickness(self, obj):
        return obj.thickness()


class WellSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source="created_by.get_full_name", read_only=True
    )
    layers = GeologyLayerSerializer(many=True, read_only=True)

    class Meta:
        model = Well
        fields = "__all__"
        extra_kwargs = {
            "planned_depth": {"required": False, "allow_null": True},
            "structure": {"required": False, "allow_blank": True},
            "start_date": {"required": False, "allow_null": True},
        }
