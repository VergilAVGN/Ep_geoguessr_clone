from app.schemas.settings import Difficulty, GameMode, SettingsOut, SettingsUpdate


class SettingsService:
    def __init__(self) -> None:
        self.settings = SettingsOut(
            mode=GameMode.classic,
            difficulty=Difficulty.normal,
            show_hints=True,
            show_circle_hints=True,
            show_data_hints=True,
            map_source="default",
            show_timer=True,
        )

    def get_settings(self) -> SettingsOut:
        return self.settings

    def update_settings(self, settings_update: SettingsUpdate) -> SettingsOut:
        update_data = settings_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(self.settings, key, value)
        return self.settings


settings_service = SettingsService()
