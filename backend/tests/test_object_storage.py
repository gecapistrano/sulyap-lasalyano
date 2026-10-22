"""Unit tests for catalog photo object keys, URL passthrough, and mocked Storage uploads."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.responses import FileResponse, RedirectResponse  # noqa: E402

from app.services.media_urls import (  # noqa: E402
    is_http_url,
    is_supabase_storage_url,
    passthrough_media_url,
    public_model_url,
)
from app.services.id_codes import accession_codes_from_filename  # noqa: E402
from app.services.object_storage import (  # noqa: E402
    StorageSettings,
    object_key_for_artifact,
    object_key_for_artifact_code,
    object_key_for_model,
    object_key_for_president,
    public_object_url,
    upload_bytes,
)
from app.services.model_uploads import local_model_media_url  # noqa: E402
from app.services.photo_uploads import (  # noqa: E402
    find_local_photo,
    photo_file_or_redirect,
    photo_path_for_media_key,
)


class ObjectKeyTests(unittest.TestCase):
    def test_artifact_numeric_id_normalizes_jpeg(self) -> None:
        self.assertEqual(object_key_for_artifact(12, ".JPG"), "artifacts/12.jpg")
        self.assertEqual(object_key_for_artifact(12, ".jpeg"), "artifacts/12.jpg")
        self.assertEqual(object_key_for_artifact(7, ".png"), "artifacts/7.png")

    def test_artifact_rejects_non_positive_id(self) -> None:
        with self.assertRaises(ValueError):
            object_key_for_artifact(0, ".jpg")

    def test_artifact_accession_key(self) -> None:
        self.assertEqual(object_key_for_artifact_code("rd244", ".png"), "artifacts/RD244.png")

    def test_president_from_catalog_name(self) -> None:
        self.assertEqual(
            object_key_for_president('Br. Francisco "Sockie" dela Rosa VI, FSC', ".jpg"),
            "presidents/br-sockie.jpg",
        )
        self.assertEqual(
            object_key_for_president("Br. Iñigo Riola, FSC", ".jpg"),
            "presidents/br-inigo.jpg",
        )

    def test_president_from_filename_stem(self) -> None:
        self.assertEqual(object_key_for_president("Br. Mawel", ".jpg"), "presidents/br-mawel.jpg")
        self.assertEqual(object_key_for_president("Br Inigo", ".jpg"), "presidents/br-inigo.jpg")
        self.assertEqual(object_key_for_president("Dr. Quebengco", ".webp"), "presidents/dr-quebengco.webp")

    def test_accession_codes_from_filename(self) -> None:
        self.assertEqual(accession_codes_from_filename("AG001.glb"), ["AG001"])
        self.assertEqual(accession_codes_from_filename("AG028-AG029.glb"), ["AG028", "AG029"])
        self.assertEqual(object_key_for_model("AG001.glb"), "models/AG001.glb")

    def test_model_key_from_filename(self) -> None:
        self.assertEqual(object_key_for_model("9_deadbeefdeadbeef.glb"), "models/9_deadbeefdeadbeef.glb")
        self.assertEqual(object_key_for_model("models/plaque.glb"), "models/plaque.glb")
        with self.assertRaises(ValueError):
            object_key_for_model("../secret.glb")
        with self.assertRaises(ValueError):
            object_key_for_model("plaque.obj")

    def test_public_url_shape(self) -> None:
        settings = StorageSettings(
            url="https://abc.supabase.co",
            service_role_key="test-key",
            bucket="catalog-photos",
        )
        self.assertEqual(
            public_object_url(settings, "artifacts/12.jpg"),
            "https://abc.supabase.co/storage/v1/object/public/catalog-photos/artifacts/12.jpg",
        )


class PassthroughTests(unittest.TestCase):
    def test_https_url_returned_as_is(self) -> None:
        url = "https://abc.supabase.co/storage/v1/object/public/catalog-photos/artifacts/1.jpg"
        self.assertEqual(passthrough_media_url(url), url)
        self.assertTrue(is_http_url(url))

    def test_relative_curator_path_unchanged(self) -> None:
        rel = "/curator-media/artifacts/import_RD244.png"
        self.assertEqual(passthrough_media_url(rel), rel)
        self.assertFalse(is_http_url(rel))

    def test_media_models_path_unchanged(self) -> None:
        rel = "/media/models/9_deadbeef.glb"
        self.assertEqual(passthrough_media_url(rel), rel)
        self.assertFalse(is_http_url(rel))

    def test_rejects_non_http_schemes(self) -> None:
        self.assertFalse(is_http_url("javascript:alert(1)"))
        self.assertFalse(is_http_url("https://example.com/a.jpg\nLocation: https://evil.test"))

    def test_public_model_url_rewrites_off_storage(self) -> None:
        src = "https://abc.supabase.co/storage/v1/object/public/catalog-photos/models/AG013.glb"
        self.assertTrue(is_supabase_storage_url(src))
        self.assertEqual(
            public_model_url(src, public_base="https://cdn.example/catalog-photos"),
            "https://cdn.example/catalog-photos/models/AG013.glb",
        )
        self.assertEqual(public_model_url(src, omit_storage=True), "")
        self.assertEqual(public_model_url(src), src)
        self.assertEqual(
            public_model_url(
                src,
                public_base="https://cdn.example/catalog-photos",
                omit_storage=True,
            ),
            "https://cdn.example/catalog-photos/models/AG013.glb",
        )

    def test_production_forces_omit_storage_models(self) -> None:
        from app.core.config import Settings

        settings = Settings(
            app_env="production",
            jwt_secret_key="unit-test-jwt-secret-key-value",
            frontend_origins="https://hall.example",
            cookie_secure=True,
            cookie_samesite="none",
            catalog_omit_storage_models=False,
            public_model_base_url="",
        )
        self.assertTrue(settings.catalog_omit_storage_models)
        self.assertFalse(settings.catalog_prefer_local_media)

    def test_photo_route_redirects_http_url(self) -> None:
        url = "https://abc.supabase.co/storage/v1/object/public/catalog-photos/artifacts/1.jpg"
        response = photo_file_or_redirect(url)
        self.assertIsInstance(response, RedirectResponse)
        self.assertEqual(response.status_code, 307)
        self.assertEqual(response.headers.get("location"), url)

    def test_local_resolver_ignores_https(self) -> None:
        self.assertIsNone(
            photo_path_for_media_key(
                "https://abc.supabase.co/storage/v1/object/public/catalog-photos/artifacts/1.jpg"
            )
        )


class UploadMockTests(unittest.TestCase):
    def test_upload_bytes_returns_public_url_without_network(self) -> None:
        settings = StorageSettings(url="https://abc.supabase.co", service_role_key="test-key")
        with patch("app.services.object_storage._storage_request", return_value=(200, b"{}")) as mocked:
            url = upload_bytes(settings, "artifacts/1.jpg", b"abc", content_type="image/jpeg")
        self.assertEqual(
            url,
            "https://abc.supabase.co/storage/v1/object/public/catalog-photos/artifacts/1.jpg",
        )
        mocked.assert_called_once()
        args, kwargs = mocked.call_args
        self.assertEqual(args[0], "POST")
        self.assertIn("/storage/v1/object/catalog-photos/artifacts/1.jpg", args[1])
        self.assertIn("cacheControl=31536000", args[1])
        self.assertEqual(kwargs.get("data"), b"abc")
        self.assertEqual(kwargs["headers"].get("x-upsert"), "true")
        self.assertEqual(kwargs["headers"].get("cache-control"), "31536000")
        self.assertTrue(kwargs["headers"]["Authorization"].startswith("Bearer "))

    def test_upload_glb_bytes_uses_model_content_type(self) -> None:
        settings = StorageSettings(url="https://abc.supabase.co", service_role_key="test-key")
        with patch("app.services.object_storage._storage_request", return_value=(200, b"{}")) as mocked:
            url = upload_bytes(settings, "models/1.glb", b"glTF....", content_type="model/gltf-binary")
        self.assertEqual(
            url,
            "https://abc.supabase.co/storage/v1/object/public/catalog-photos/models/1.glb",
        )
        mocked.assert_called_once()
        self.assertIn("/storage/v1/object/catalog-photos/models/1.glb", mocked.call_args[0][1])
        self.assertIn("cacheControl=31536000", mocked.call_args[0][1])
        self.assertEqual(mocked.call_args[1]["headers"].get("cache-control"), "31536000")

    def test_from_env_missing_returns_none(self) -> None:
        with patch.dict(
            os.environ,
            {"SUPABASE_URL": "", "SUPABASE_SERVICE_ROLE_KEY": "", "SUPABASE_STORAGE_BUCKET": ""},
            clear=False,
        ):
            self.assertIsNone(StorageSettings.from_env())

    def test_from_env_rejects_dashboard_url(self) -> None:
        from app.services.object_storage import StorageError

        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://supabase.com/dashboard/project/ifsdbbmgpvysbfsrqvhi",
                "SUPABASE_SERVICE_ROLE_KEY": "test-key",
            },
            clear=False,
        ):
            with self.assertRaises(StorageError):
                StorageSettings.from_env()


class LocalMediaPreferTests(unittest.TestCase):
    def test_local_model_url_from_accession_file(self) -> None:
        storage = "https://abc.supabase.co/storage/v1/object/public/catalog-photos/models/AG013.glb"
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "AG013.glb").write_bytes(b"glTF")
            with patch("app.services.model_uploads.UPLOADS_ROOT", root):
                self.assertEqual(local_model_media_url(storage, "AG013"), "/media/models/AG013.glb")
                self.assertEqual(local_model_media_url("https://x.example/models/RD244.glb", "RD244"), "")

    def test_local_model_url_ignores_missing_dir(self) -> None:
        with patch("app.services.model_uploads.UPLOADS_ROOT", Path("/no/such/sulyap-models")):
            self.assertEqual(local_model_media_url("https://x.example/models/AG013.glb", "AG013"), "")

    def test_find_local_photo_import_prefix(self) -> None:
        storage = "https://abc.supabase.co/storage/v1/object/public/catalog-photos/artifacts/AG013.png"
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "import_AG013.png").write_bytes(b"png")
            with patch("app.services.photo_uploads.PHOTOS_ROOT", root):
                found = find_local_photo(storage, id_code="AG013", artifact_id=13)
                self.assertIsNotNone(found)
                self.assertEqual(found.name, "import_AG013.png")
                served = photo_file_or_redirect(
                    storage, id_code="AG013", artifact_id=13, prefer_local=True
                )
                self.assertIsInstance(served, FileResponse)

    def test_https_still_redirects_when_local_prefer_off(self) -> None:
        url = "https://abc.supabase.co/storage/v1/object/public/catalog-photos/artifacts/1.jpg"
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "import_AG013.png").write_bytes(b"png")
            with patch("app.services.photo_uploads.PHOTOS_ROOT", root):
                response = photo_file_or_redirect(url, id_code="AG013", prefer_local=False)
        self.assertIsInstance(response, RedirectResponse)
        self.assertEqual(response.headers.get("location"), url)


if __name__ == "__main__":
    unittest.main()
