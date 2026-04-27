from app.auth import UserCtx, can_edit_rca, can_delete_rca


CREATOR = "creator@example.com"
ASSIGNEE = "assignee@example.com"
OUTSIDER = "outsider@example.com"
ADMIN = "admin@example.com"

ASSIGNEES = {ASSIGNEE}


def _u(email: str, is_admin: bool = False) -> UserCtx:
    return UserCtx(email=email, name=email.split("@")[0], is_admin=is_admin)


def test_admin_can_edit_anything():
    assert can_edit_rca(_u(ADMIN, is_admin=True), CREATOR, ASSIGNEES) is True
    assert can_edit_rca(_u(ADMIN, is_admin=True), CREATOR, set()) is True


def test_admin_can_delete_anything():
    assert can_delete_rca(_u(ADMIN, is_admin=True), CREATOR) is True


def test_creator_can_edit_and_delete_own():
    assert can_edit_rca(_u(CREATOR), CREATOR, ASSIGNEES) is True
    assert can_delete_rca(_u(CREATOR), CREATOR) is True


def test_assignee_can_edit_but_not_delete():
    assert can_edit_rca(_u(ASSIGNEE), CREATOR, ASSIGNEES) is True
    assert can_delete_rca(_u(ASSIGNEE), CREATOR) is False


def test_outsider_cannot_edit_or_delete():
    assert can_edit_rca(_u(OUTSIDER), CREATOR, ASSIGNEES) is False
    assert can_delete_rca(_u(OUTSIDER), CREATOR) is False


def test_empty_assignees_outsider_still_blocked():
    assert can_edit_rca(_u(OUTSIDER), CREATOR, set()) is False
