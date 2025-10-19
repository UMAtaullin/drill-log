from django.db import models
from django.contrib.auth.models import User


class Well(models.Model):
    """Данные перед бурением - заполняется один раз"""

    DRILLING_METHODS = (
        ("rotary", "Ротационное бурение"),
        ("auger", "Шнековое бурение"),
        ("percussion", "Ударно-канатное бурение"),
        ("core", "Колонковое бурение"),
    )

    # Основные данные
    name = models.CharField(
        max_length=100, unique=True, verbose_name="Название скважины"
    )
    area = models.CharField(max_length=100, verbose_name="Наименование участка")
    structure = models.CharField(max_length=100, verbose_name="Наименование сооружения")

    # Даты
    start_date = models.DateField(verbose_name="Дата начала бурения")
    end_date = models.DateField(verbose_name="Дата окончания бурения")

    # Технические параметры
    planned_depth = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Проектная глубина, м"
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, verbose_name="Широта"
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, verbose_name="Долгота"
    )
    drilling_method = models.CharField(
        max_length=20, choices=DRILLING_METHODS, verbose_name="Способ бурения"
    )
    drilling_rig = models.CharField(max_length=100, verbose_name="Буровая установка")
    vehicle = models.CharField(max_length=100, verbose_name="Транспортное средство")
    diameter = models.CharField(max_length=50, verbose_name="Диаметр бурения, мм")

    # Системные поля
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, verbose_name="Геолог"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Скважина"
        verbose_name_plural = "Скважины"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.area})"


class GeologyLayer(models.Model):
    """Слои в процессе бурения - заполняется по мере бурения"""

    LITHOLOGY_TYPES = (
        ("sand", "Песок"),
        ("clay", "Глина"),
        ("loam", "Суглинок"),
        ("sandy_loam", "Супесь"),
        ("peat", "Торф"),
        ("gravel", "Гравий"),
        ("boulder", "Валуны"),
        ("fill", "Насыпной грунт"),
    )

    well = models.ForeignKey(
        Well, on_delete=models.CASCADE, related_name="layers", verbose_name="Скважина"
    )
    layer_number = models.IntegerField(verbose_name="Номер слоя")
    depth_from = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Глубина от, м"
    )
    depth_to = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Глубина до, м"
    )
    lithology = models.CharField(
        max_length=20, choices=LITHOLOGY_TYPES, verbose_name="Литология"
    )
    description = models.TextField(verbose_name="Описание грунта")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Геологический слой"
        verbose_name_plural = "Геологические слои"
        ordering = ["well", "depth_from"]
        unique_together = ["well", "layer_number"]

    def thickness(self):
        """Автоматический расчет мощности слоя"""
        if self.depth_from is not None and self.depth_to is not None:
            return float(self.depth_to) - float(self.depth_from)
        return 0.0

    thickness.short_description = "Мощность, м"

    def __str__(self):
        return f"{self.well.name} - слой {self.layer_number} ({self.depth_from}-{self.depth_to}м)"
