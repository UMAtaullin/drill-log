from django.contrib import admin
from .models import Well, GeologyLayer


class GeologyLayerInline(admin.TabularInline):
    """Слои прямо в форме скважины"""

    model = GeologyLayer
    extra = 1
    fields = (
        "layer_number",
        "depth_from",
        "depth_to",
        "lithology",
        "description",
        "thickness",
    )
    readonly_fields = ("thickness",)


@admin.register(Well)
class WellAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "area",
        "structure",
        "planned_depth",
        "geologist",
        "created_by",
        "created_at",
    )
    list_filter = ("area", "created_at")
    search_fields = ("name", "area", "structure")
    readonly_fields = ("created_at", "updated_at")
    inlines = [GeologyLayerInline]

    fieldsets = (
        (
            "Основные данные",
            {
                "fields": (
                    "name",
                    "area",
                    "structure",
                    "planned_depth",
                    "geologist",
                    "start_date",
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
        "created_at",
    )
    list_filter = ("lithology", "well", "created_at")
    search_fields = ("well__name", "description")
    readonly_fields = ("thickness_display", "created_at")

    def thickness_display(self, obj):
        return f"{obj.thickness()} м"

    thickness_display.short_description = "Мощность"
