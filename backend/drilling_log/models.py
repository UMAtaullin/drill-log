from django.db import models
from django.contrib.auth.models import User


class Well(models.Model):
    STATUS_CHOICES = (
        ("planned", "Запланирована"),
        ("drilling", "В процессе бурения"),
        ("completed", "Завершена"),
        ("abandoned", "Ликвидирована"),
    )

    name = models.CharField(
        max_length=100, unique=True, verbose_name="Название скважины"
    )
    field = models.CharField(max_length=100, verbose_name="Месторождение")
    location = models.CharField(max_length=200, verbose_name="Координаты")
    planned_depth = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name="Плановая глубина, м"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="planned", verbose_name="Статус"
    )
    start_date = models.DateField(
        null=True, blank=True, verbose_name="Дата начала бурения"
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
        return f"{self.name} ({self.get_status_display()})"


class LithologySample(models.Model):
    """Литологическая проба - основная сущность для геолога"""

    ROCK_TYPES = (
        ("clay", "Глина"),
        ("sand", "Песок"),
        ("silt", "Алевролит"),
        ("limestone", "Известняк"),
        ("dolomite", "Доломит"),
        ("sandstone", "Песчаник"),
        ("shale", "Аргиллит"),
        ("coal", "Уголь"),
        ("conglomerate", "Конгломерат"),
        ("breccia", "Брекчия"),
        ("tuff", "Туф"),
        ("other", "Другое"),
    )

    well = models.ForeignKey(
        Well, on_delete=models.CASCADE, related_name="samples", verbose_name="Скважина"
    )
    depth_from = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Глубина от, м"
    )
    depth_to = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Глубина до, м"
    )
    rock_type = models.CharField(
        max_length=20, choices=ROCK_TYPES, verbose_name="Тип породы"
    )
    description = models.TextField(blank=True, verbose_name="Описание")
    color = models.CharField(max_length=50, blank=True, verbose_name="Цвет")
    hardness = models.CharField(max_length=50, blank=True, verbose_name="Твердость")
    additional_notes = models.TextField(
        blank=True, verbose_name="Дополнительные заметки"
    )
    collected_by = models.ForeignKey(
        User, on_delete=models.CASCADE, verbose_name="Геолог"
    )
    collected_at = models.DateTimeField(auto_now_add=True, verbose_name="Время отбора")

    class Meta:
        verbose_name = "Литологическая проба"
        verbose_name_plural = "Литологические пробы"
        ordering = ["well", "depth_from"]

    def __str__(self):
        return f"{self.well.name} - {self.depth_from}-{self.depth_to}м - {self.get_rock_type_display()}"


class DailyReport(models.Model):
    """Ежедневный отчет по бурению"""

    well = models.ForeignKey(
        Well,
        on_delete=models.CASCADE,
        related_name="daily_reports",
        verbose_name="Скважина",
    )
    date = models.DateField(verbose_name="Дата")
    drilled_meters = models.DecimalField(
        max_digits=6, decimal_places=2, verbose_name="Пробурено за день, м"
    )
    current_depth = models.DecimalField(
        max_digits=8, decimal_places=2, verbose_name="Текущая глубина, м"
    )
    drilling_time = models.DecimalField(
        max_digits=4, decimal_places=1, default=0, verbose_name="Время бурения, часов"
    )
    remarks = models.TextField(blank=True, verbose_name="Примечания и наблюдения")
    reported_by = models.ForeignKey(
        User, on_delete=models.CASCADE, verbose_name="Отчет составил"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Дневной отчет"
        verbose_name_plural = "Дневные отчеты"
        unique_together = ["well", "date"]
        ordering = ["-date", "well"]

    def __str__(self):
        return f"{self.well.name} - {self.date} - {self.drilled_meters}м"
