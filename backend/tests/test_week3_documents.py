"""
Tests for Week 3 — S3 service validation logic.

These tests verify MIME type and file size validation without
making real network calls to AWS.
"""

from app.services.s3 import (
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    build_s3_key,
)


class TestS3KeyGeneration:
    def test_key_includes_business_id(self):
        key = build_s3_key(business_id=42, filename="receipt.pdf")
        assert key.startswith("compliance-documents/42/")

    def test_key_preserves_extension(self):
        key = build_s3_key(business_id=1, filename="vat-return.pdf")
        assert key.endswith(".pdf")

    def test_key_is_unique(self):
        key1 = build_s3_key(business_id=1, filename="file.pdf")
        key2 = build_s3_key(business_id=1, filename="file.pdf")
        assert key1 != key2

    def test_key_handles_no_extension(self):
        key = build_s3_key(business_id=1, filename="uploadfile")
        assert key.startswith("compliance-documents/1/")
        assert key.endswith(".bin")


class TestAllowedMimeTypes:
    def test_pdf_allowed(self):
        assert "application/pdf" in ALLOWED_MIME_TYPES

    def test_jpeg_allowed(self):
        assert "image/jpeg" in ALLOWED_MIME_TYPES

    def test_png_allowed(self):
        assert "image/png" in ALLOWED_MIME_TYPES

    def test_docx_allowed(self):
        assert "application/vnd.openxmlformats-officedocument.wordprocessingml.document" in ALLOWED_MIME_TYPES

    def test_exe_not_allowed(self):
        assert "application/octet-stream" not in ALLOWED_MIME_TYPES

    def test_gif_not_allowed(self):
        assert "image/gif" not in ALLOWED_MIME_TYPES


class TestFileSizeLimits:
    def test_max_size_is_10mb(self):
        assert MAX_FILE_SIZE_BYTES == 10 * 1024 * 1024

    def test_11mb_exceeds_limit(self):
        assert 11 * 1024 * 1024 > MAX_FILE_SIZE_BYTES

    def test_9mb_within_limit(self):
        assert 9 * 1024 * 1024 < MAX_FILE_SIZE_BYTES