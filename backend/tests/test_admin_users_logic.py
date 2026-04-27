"""Logic-only checks for admin-user endpoints. Excludes the DB-dependent paths."""
from app.api.admin_users import _is_seed_admin
from app.config import settings


def _override(emails: str) -> None:
    settings.admin_emails = emails
    if "admin_email_list" in settings.__dict__:
        del settings.__dict__["admin_email_list"]


def test_seed_admin_lookup_is_case_insensitive():
    _override("a@x.com,Bob@example.com")
    assert _is_seed_admin("a@x.com") is True
    assert _is_seed_admin("A@X.COM") is True
    assert _is_seed_admin("bob@example.com") is True
    assert _is_seed_admin("Bob@EXAMPLE.com") is True
    assert _is_seed_admin("not-listed@x.com") is False


def test_seed_admin_handles_blank_env():
    _override("")
    assert _is_seed_admin("anyone@x.com") is False


def test_seed_admin_strips_whitespace():
    _override("  a@x.com ,  b@x.com  ")
    assert _is_seed_admin("a@x.com") is True
    assert _is_seed_admin("b@x.com") is True
