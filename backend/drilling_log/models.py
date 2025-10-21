from django.db import models
from django.contrib.auth.models import User


class Well(models.Model):
    """Данные перед бурением"""

    name = models.CharField(
        max_length=100, unique=True, verbose_name="Название скважины"
    )
    area = models.CharField(max_length=100, verbose_name="Наименование участка")
    structure = models.CharField(
        max_length=100, blank=True, verbose_name="Наименование сооружения"
    )
    planned_depth = models.DecimalField(
        max_digits=6, decimal_places=2, default=0, verbose_name="Проектная глубина, м"
    )
    start_date = models.DateField(
        null=True, blank=True, verbose_name="Дата начала бурения"
    )
    geologist = models.CharField(
        max_length=100, verbose_name="Геолог", default="Неизвестный геолог"
    )
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, verbose_name="Создал"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Скважина"
        verbose_name_plural = "Скважины"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class GeologyLayer(models.Model):
    """Слои в процессе бурения"""

    LITHOLOGY_TYPES = (
        ("prs", "🟫 ПРС (Поверхностно-растительный слой)"),
        ("peat", "🟤 Торф"),
        ("sand", "🟡 Песок"),
        ("loam", "🔵 Суглинок"),
        ("sandy_loam", "🟠 Супесь"),
    )

    well = models.ForeignKey(
        Well, on_delete=models.CASCADE, related_name="layers", verbose_name="Скважина"
    )
    layer_number = models.IntegerField(default=1, verbose_name="Номер слоя")
    depth_from = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Глубина от, м"
    )
    depth_to = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Глубина до, м"
    )
    lithology = models.CharField(
        max_length=20, choices=LITHOLOGY_TYPES, verbose_name="Литология"
    )
    description = models.TextField(blank=True, verbose_name="Описание")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Геологический слой"
        verbose_name_plural = "Геологические слои"
        ordering = ["depth_from"]

    def thickness(self):
        """Автоматический расчет мощности слоя"""
        if self.depth_from is not None and self.depth_to is not None:
            return float(self.depth_to) - float(self.depth_from)
        return 0.0

    thickness.short_description = "Мощность, м"

    def __str__(self):
        return f"{self.well.name} - {self.depth_from}-{self.depth_to}м - {self.get_lithology_display()}"
