VALID_CONFIRMATION_METHODS = {
    "MANUAL",
    "SCAN",
    "RFID",
    "GPS",
    "SYSTEM_IMPORT",
}


def require_positive_integer(value, field_name):
    """Return an integer or raise a clear validation error."""
    if isinstance(value, bool):
        raise ValueError(f"{field_name} must be a positive integer")

    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a positive integer") from None

    if number <= 0:
        raise ValueError(f"{field_name} must be a positive integer")

    return number


def validate_confirmation_method(value):
    method = str(value or "").strip().upper()

    if method not in VALID_CONFIRMATION_METHODS:
        allowed = ", ".join(sorted(VALID_CONFIRMATION_METHODS))
        raise ValueError(f"confirmation_method must be one of: {allowed}")

    return method


def validate_operating_minutes(value):
    if value is None:
        return 0

    minutes = require_positive_integer(value, "operating_minutes")

    if minutes > 720:
        raise ValueError("operating_minutes cannot exceed 720 for one move")

    return minutes

