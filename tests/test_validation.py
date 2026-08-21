import pytest

from validation import (
    require_positive_integer,
    validate_confirmation_method,
    validate_operating_minutes,
)


def test_positive_integer_accepts_number_string():
    assert require_positive_integer("24", "worker_id") == 24


@pytest.mark.parametrize("bad_value", [None, "", "abc", 0, -2, True])
def test_positive_integer_rejects_bad_values(bad_value):
    with pytest.raises(ValueError):
        require_positive_integer(bad_value, "worker_id")


def test_confirmation_method_is_normalized():
    assert validate_confirmation_method("scan") == "SCAN"


def test_confirmation_method_rejects_unknown_method():
    with pytest.raises(ValueError):
        validate_confirmation_method("guess")


def test_operating_minutes_allows_missing_value():
    assert validate_operating_minutes(None) == 0


def test_operating_minutes_rejects_more_than_twelve_hours():
    with pytest.raises(ValueError):
        validate_operating_minutes(721)

