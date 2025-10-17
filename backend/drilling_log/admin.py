from django.contrib import admin
from .models import Well, LithologySample, DailyReport


@admin.register(Well)
class WellAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "field",
        "status",
        "planned_depth",
        "start_date",
        "created_by",
    )
    list_filter = ("status", "field", "start_date")
    search_fields = ("name", "field", "location")
    readonly_fields = ("created_at", "updated_at")


@admin.register(LithologySample)
class LithologySampleAdmin(admin.ModelAdmin):
    list_display = (
        "well",
        "depth_from",
        "depth_to",
        "rock_type",
        "collected_by",
        "collected_at",
    )
    list_filter = ("rock_type", "well", "collected_at")
    search_fields = ("well__name", "description")
    readonly_fields = ("collected_at",)


@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display = ("well", "date", "drilled_meters", "current_depth", "reported_by")
    list_filter = ("date", "well")
    search_fields = ("well__name", "remarks")
    readonly_fields = ("created_at",)
    date_hierarchy = "date"
