from django.contrib import admin
from .models import Well, GeologyLayer


class GeologyLayerInline(admin.TabularInline):
    """Слои прямо в форме скважины"""

    model = GeologyLayer
    extra = 1
    readonly_fields = ("thickness",)

    def thickness(self, obj):
        if obj.pk:  # Только для сохраненных объектов
            return f"{obj.thickness()} м"
        return "—"

    thickness.short_description = "Мощность"


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
        "thickness_display",
    )
    list_filter = ("lithology", "well")
    search_fields = ("well__name", "description")
    readonly_fields = ("thickness_display", "created_at")

    def thickness_display(self, obj):
        return f"{obj.thickness()} м"

    thickness_display.short_description = "Мощность"
