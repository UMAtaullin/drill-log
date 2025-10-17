from django.db import models
from django.contrib.auth.models import User


class Well(models.Model):
    name = models.CharField(max_length=100, verbose_name="Название скважины")
    location = models.CharField(max_length=200, verbose_name="Местоположение")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
