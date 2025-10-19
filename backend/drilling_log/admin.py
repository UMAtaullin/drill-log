from django.contrib import admin
from .models import Well, GeologyLayer


class GeologyLayerInline(admin.TabularInline):
    """Слои прямо в форме скважины"""

    model = GeologyLayer
    extra = 1
    readonly_fields = ("thickness",)


@admin.register(Well)
class WellAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "area",
        "structure",
        "start_date",
        "planned_depth",
        "created_by",
    )
    list_filter = ("area", "drilling_method", "start_date")
    search_fields = ("name", "area", "structure")
    readonly_fields = ("created_at", "updated_at")
    inlines = [GeologyLayerInline]

    fieldsets = (
        ("Основные данные", {"fields": ("name", "area", "structure")}),
        ("Даты", {"fields": ("start_date", "end_date")}),
        (
            "Технические параметры",
            {
                "fields": (
                    "planned_depth",
                    "latitude",
                    "longitude",
                    "drilling_method",
                    "drilling_rig",
                    "vehicle",
                    "diameter",
                )
            },
        ),
        (
            "Системная информация",
            {
                "fields": ("created_by", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(GeologyLayer)
class GeologyLayerAdmin(admin.ModelAdmin):
    list_display = (
        "well",
        "layer_number",
        "depth_from",
        "depth_to",
        "lithology",
        "thickness",
    )
    list_filter = ("lithology", "well")
    search_fields = ("well__name", "description")
    readonly_fields = ("thickness", "created_at")

    def thickness(self, obj):
        return obj.thickness()

    thickness.short_description = "Мощность, м"
