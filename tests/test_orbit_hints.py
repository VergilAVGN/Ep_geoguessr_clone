from app.services.geo_metadata_service import satellite_name_for_layer
from app.services.hints_orbit_service import build_orbit_hint_facts


def test_satellite_name_is_derived_from_gibs_layer():
    assert satellite_name_for_layer("MODIS_Terra_CorrectedReflectance_TrueColor") == "Terra (MODIS)"
    assert satellite_name_for_layer("MODIS_Aqua_CorrectedReflectance_TrueColor") == "Aqua (MODIS)"
    assert satellite_name_for_layer("VIIRS_SNPP_CorrectedReflectance_TrueColor") == "Suomi NPP (VIIRS)"


def test_hint_facts_use_metadata_without_exposing_coordinates(monkeypatch):
    monkeypatch.setattr(
        "app.services.hints_orbit_service.get_geo_metadata",
        lambda *args: type(
            "Metadata",
            (),
            {
                "satellite": "Terra (MODIS)",
                "acquisition_date": "2024-05-15",
                "continent": "Asia",
                "elevation_m": 420,
                "distance_to_coast_km": 180,
                "surface_type": "Bare / sparse vegetation / Desert",
                "hemisphere": "Northern",
            },
        )(),
    )

    assert build_orbit_hint_facts(0, 0, "unused", "2024-05-15") == [
        "Satellite: Terra (MODIS)",
        "Acquisition: 2024-05-15 UTC",
        "Continent: Asia",
        "Surface: Bare / sparse vegetation / Desert",
        "Elevation: 420 m",
        "Distance to coast: ≈180 km",
        "Hemisphere: Northern",
    ]
